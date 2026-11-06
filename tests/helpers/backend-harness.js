'use strict';
// Test harness that runs the apps/backend API in isolation.
//
//   const { startBackend } = require('./helpers/backend-harness');
//   const backend = await startBackend();
//   // backend.baseUrl  e.g. 'http://127.0.0.1:41234'
//   // backend.port     the free port the server listens on (passed via PORT)
//   // backend.dir      temp copy of apps/backend (cwd of seed.js / server.js)
//   // backend.dbFile   <dir>/todo.db, the temp database (never apps/backend/todo.db)
//   // backend.login(u, p)   -> { token, user } via POST /api/users/login (default demo/demo)
//   // backend.insertToken(token, userId, expires) inserts a row into the temp DB tokens table
//   // await backend.stop();  kills the server and removes the temp dir
//
// apps/backend is copied (without node_modules and *.db files) to a temp dir,
// node_modules is symlinked, the copy is seeded with `node seed.js` and
// `node server.js` is spawned with PORT set to a free port.

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const BACKEND_SRC = path.resolve(__dirname, '..', '..', 'apps', 'backend');

function copyBackend(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === 'node_modules' || /\.db(-journal|-shm|-wal)?$/.test(entry.name)) return;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyBackend(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  });
}

function getFreePort() {
  return new Promise(function (resolve, reject) {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', function () {
      const port = srv.address().port;
      srv.close(function () { resolve(port); });
    });
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function waitForReady(baseUrl, child, getLog) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('backend exited early (code ' + child.exitCode + '):\n' + getLog());
    }
    try {
      const res = await fetch(baseUrl + '/');
      if (res.status === 200) return;
    } catch (e) {
      // not listening yet
    }
    await sleep(100);
  }
  throw new Error('backend did not become ready in time:\n' + getLog());
}

async function startBackend() {
  const nodeModules = path.join(BACKEND_SRC, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    throw new Error('apps/backend/node_modules missing; run: npm --prefix apps/backend ci');
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-backend-'));
  const cleanup = function () { fs.rmSync(dir, { recursive: true, force: true }); };
  let child;

  try {
    copyBackend(BACKEND_SRC, dir);
    fs.symlinkSync(nodeModules, path.join(dir, 'node_modules'), 'dir');

    const seed = spawnSync(process.execPath, ['seed.js'], { cwd: dir, encoding: 'utf8' });
    if (seed.status !== 0) {
      throw new Error('seed.js failed (' + seed.status + '): ' + seed.stdout + seed.stderr);
    }

    const port = await getFreePort();
    const baseUrl = 'http://127.0.0.1:' + port;
    let log = '';
    child = spawn(process.execPath, ['server.js'], {
      cwd: dir,
      env: Object.assign({}, process.env, { PORT: String(port) }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', function (d) { log += d; });
    child.stderr.on('data', function (d) { log += d; });

    await waitForReady(baseUrl, child, function () { return log; });

    const dbFile = path.join(dir, 'todo.db');
    const required = function (name) { return require(path.join(dir, 'node_modules', name)); };

    return {
      baseUrl: baseUrl,
      port: port,
      dir: dir,
      dbFile: dbFile,
      log: function () { return log; },
      login: async function (username, password) {
        const res = await fetch(baseUrl + '/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username || 'demo', password: password || 'demo' })
        });
        if (res.status !== 200) throw new Error('login failed with ' + res.status);
        return res.json();
      },
      insertToken: function (token, userId, expires) {
        const sqlite3 = required('sqlite3');
        return new Promise(function (resolve, reject) {
          const conn = new sqlite3.Database(dbFile);
          conn.run('INSERT INTO tokens (token, user_id, expires) VALUES (?, ?, ?)',
            [token, userId, expires], function (err) {
              conn.close(function () { err ? reject(err) : resolve(); });
            });
        });
      },
      // moment().format() style timestamp, offsetHours from now
      timestamp: function (offsetHours) {
        return required('moment')().add(offsetHours, 'hours').format();
      },
      stop: async function () {
        if (child && child.exitCode === null) {
          const exited = new Promise(function (resolve) { child.once('exit', resolve); });
          child.kill('SIGKILL');
          await exited;
        }
        cleanup();
      }
    };
  } catch (err) {
    if (child && child.exitCode === null) child.kill('SIGKILL');
    cleanup();
    throw err;
  }
}

module.exports = { startBackend: startBackend };
