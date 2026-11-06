'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

test('root package.json is private and has no dependencies', () => {
  const pkg = readJson('package.json');
  assert.strictEqual(pkg.private, true);
  assert.strictEqual(pkg.dependencies, undefined);
  assert.strictEqual(pkg.devDependencies, undefined);
});

test('root scripts delegate to per-app commands', () => {
  const s = readJson('package.json').scripts;
  assert.strictEqual(s['install:all'], 'npm --prefix apps/backend install && npm --prefix apps/frontend install');
  assert.strictEqual(s.seed, 'npm --prefix apps/backend run seed');
  assert.strictEqual(s['start:api'], 'npm --prefix apps/backend start');
  assert.strictEqual(s['start:web'], 'npm --prefix apps/frontend start');
  assert.strictEqual(s.dev, 'node scripts/dev.js');
  assert.strictEqual(s.test, 'node --test tests/*.test.js');
});

test('targeted per-app scripts exist', () => {
  const be = readJson('apps/backend/package.json').scripts;
  const fe = readJson('apps/frontend/package.json').scripts;
  assert.ok(be.start, 'backend start');
  assert.ok(be.seed, 'backend seed');
  assert.ok(fe.start, 'frontend start');
});

test('dev runner dry run names both commands and spawns nothing', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'dev.js'), '--dry-run'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /apps\/backend/);
  assert.match(r.stdout, /apps\/frontend/);
});
