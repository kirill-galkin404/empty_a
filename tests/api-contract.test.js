'use strict';
// API contract tests for apps/backend: /api mounting, token auth, CORS,
// OPTIONS and the 500 error handler. Runs against a seeded temp copy.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startBackend } = require('./helpers/backend-harness');

const REPO_DB = path.resolve(__dirname, '..', 'apps', 'backend', 'todo.db');

let backend;
let repoDbExistedBefore;

test.before(async function () {
  repoDbExistedBefore = fs.existsSync(REPO_DB);
  backend = await startBackend();
});

test.after(async function () {
  if (backend) await backend.stop();
});

test('GET / returns the running banner', async function () {
  const res = await fetch(backend.baseUrl + '/');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await res.text(), 'todo api is running');
});

test('protected /api routes require a token', async function () {
  for (const p of ['/api/todos', '/api/lists', '/api/stats']) {
    const res = await fetch(backend.baseUrl + p);
    assert.strictEqual(res.status, 401, p);
  }
});

test('routes are mounted only under /api', async function () {
  const res = await fetch(backend.baseUrl + '/todos');
  assert.strictEqual(res.status, 404);
});

test('login issues a token accepted via X-Auth-Token and ?token=', async function () {
  const body = await backend.login('demo', 'demo');
  assert.ok(body.token);
  assert.strictEqual(body.user.username, 'demo');
  assert.strictEqual(body.user.password, undefined);

  const viaHeader = await fetch(backend.baseUrl + '/api/lists', { headers: { 'X-Auth-Token': body.token } });
  assert.strictEqual(viaHeader.status, 200);
  assert.ok(Array.isArray(await viaHeader.json()));

  const viaQuery = await fetch(backend.baseUrl + '/api/lists?token=' + body.token);
  assert.strictEqual(viaQuery.status, 200);

  const me = await fetch(backend.baseUrl + '/api/users/me', { headers: { 'x-auth-token': body.token } });
  assert.strictEqual(me.status, 200);
  assert.strictEqual((await me.json()).username, 'demo');
});

test('a directly seeded token is accepted via header and query', async function () {
  await backend.insertToken('seeded-valid-token', 1, backend.timestamp(24));
  const viaHeader = await fetch(backend.baseUrl + '/api/todos', { headers: { 'X-Auth-Token': 'seeded-valid-token' } });
  assert.strictEqual(viaHeader.status, 200);
  const viaQuery = await fetch(backend.baseUrl + '/api/todos?token=seeded-valid-token');
  assert.strictEqual(viaQuery.status, 200);
});

test('unknown token returns 401', async function () {
  const res = await fetch(backend.baseUrl + '/api/todos', { headers: { 'X-Auth-Token': 'no-such-token' } });
  assert.strictEqual(res.status, 401);
  const q = await fetch(backend.baseUrl + '/api/stats?token=no-such-token');
  assert.strictEqual(q.status, 401);
});

test('expired token returns 401', async function () {
  await backend.insertToken('seeded-expired-token', 1, backend.timestamp(-1));
  const res = await fetch(backend.baseUrl + '/api/todos', { headers: { 'X-Auth-Token': 'seeded-expired-token' } });
  assert.strictEqual(res.status, 401);
  const q = await fetch(backend.baseUrl + '/api/lists?token=seeded-expired-token');
  assert.strictEqual(q.status, 401);
});

test('token whose user is missing returns 401', async function () {
  await backend.insertToken('orphan-token', 9999, backend.timestamp(24));
  const res = await fetch(backend.baseUrl + '/api/todos', { headers: { 'X-Auth-Token': 'orphan-token' } });
  assert.strictEqual(res.status, 401);
});

test('logout deletes the token', async function () {
  const body = await backend.login();
  const out = await fetch(backend.baseUrl + '/api/users/logout', {
    method: 'POST',
    headers: { 'X-Auth-Token': body.token }
  });
  assert.strictEqual(out.status, 200);
  const after = await fetch(backend.baseUrl + '/api/lists', { headers: { 'X-Auth-Token': body.token } });
  assert.strictEqual(after.status, 401);
});

test('login with wrong credentials returns 401', async function () {
  const res = await fetch(backend.baseUrl + '/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo', password: 'nope' })
  });
  assert.strictEqual(res.status, 401);
});

test('responses carry CORS headers', async function () {
  for (const p of ['/', '/api/todos']) {
    const res = await fetch(backend.baseUrl + p, { headers: { Origin: 'http://example.test' } });
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*', p);
    assert.match(res.headers.get('access-control-allow-headers'), /X-Auth-Token/i, p);
    assert.match(res.headers.get('access-control-allow-methods'), /OPTIONS/, p);
  }
});

test('OPTIONS preflight returns 200 with CORS headers, without auth', async function () {
  const res = await fetch(backend.baseUrl + '/api/todos', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://example.test',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'x-auth-token'
    }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('access-control-allow-headers'), /X-Auth-Token/i);
});

test('malformed JSON body to POST /api/users/login returns 500', async function () {
  const res = await fetch(backend.baseUrl + '/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"username": "demo", '
  });
  assert.strictEqual(res.status, 500);
  assert.strictEqual(await res.text(), 'Something broke!');
});

test('tests never touched apps/backend/todo.db', function () {
  assert.notStrictEqual(backend.dbFile, REPO_DB);
  assert.ok(fs.existsSync(backend.dbFile));
  assert.strictEqual(fs.existsSync(REPO_DB), repoDbExistedBefore);
});
