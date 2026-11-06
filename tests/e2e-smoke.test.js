'use strict';
// End-to-end smoke test for apps/backend against the seeded temp copy:
// login demo/demo, stats on the seed data, todo CRUD, lists, register,
// duplicate 409 and logout. Tests run in file order and share one server.

const test = require('node:test');
const assert = require('node:assert');
const { startBackend } = require('./helpers/backend-harness');

let backend;
let demo; // { token, user }

function api(method, path, opts) {
  opts = opts || {};
  const headers = {};
  if (opts.token) headers['X-Auth-Token'] = opts.token;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(backend.baseUrl + path, {
    method: method,
    headers: headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
}

async function json(res) {
  return res.json();
}

test.before(async function () {
  backend = await startBackend();
});

test.after(async function () {
  if (backend) await backend.stop();
});

test('login demo/demo returns a token and a user without password', async function () {
  const res = await api('POST', '/api/users/login', { body: { username: 'demo', password: 'demo' } });
  assert.strictEqual(res.status, 200);
  const body = await json(res);
  assert.ok(body.token);
  assert.strictEqual(body.user.id, 1);
  assert.strictEqual(body.user.username, 'demo');
  assert.strictEqual(body.user.email, 'demo@example.com');
  assert.strictEqual('password' in body.user, false);
  demo = body;

  const me = await api('GET', '/api/users/me', { token: demo.token });
  assert.strictEqual(me.status, 200);
  assert.strictEqual((await json(me)).username, 'demo');
});

test('login with a wrong password returns 401', async function () {
  const res = await api('POST', '/api/users/login', { body: { username: 'demo', password: 'nope' } });
  assert.strictEqual(res.status, 401);
  const body = await json(res);
  assert.strictEqual(body.token, undefined);
});

test('seeded lists have todo counts', async function () {
  const res = await api('GET', '/api/lists', { token: demo.token });
  assert.strictEqual(res.status, 200);
  const lists = await json(res);
  assert.deepStrictEqual(lists.map(function (l) { return [l.id, l.name, l.color, l.total, l.done]; }), [
    [1, 'Inbox', '#999999', 2, 0],
    [2, 'Work', '#d9534f', 3, 1],
    [3, 'Home', '#5cb85c', 3, 1]
  ]);
});

test('stats on the seeded data are deterministic', async function () {
  const res = await api('GET', '/api/stats', { token: demo.token });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await json(res), {
    total: 8,
    done: 2,
    overdue: 1,
    dueToday: 1,
    tags: {
      shopping: 1,
      family: 1,
      report: 1,
      urgent: 1,
      dev: 2,
      'tech-debt': 1,
      repair: 1,
      bills: 1
    },
    percentDone: 25
  });
});

test('seeded todos are listed newest first and flag overdue ones', async function () {
  const res = await api('GET', '/api/todos', { token: demo.token });
  assert.strictEqual(res.status, 200);
  const todos = await json(res);
  assert.strictEqual(todos.length, 8);
  assert.deepStrictEqual(todos.map(function (t) { return t.id; }), [8, 7, 6, 5, 4, 3, 2, 1]);

  const report = todos.find(function (t) { return t.title === 'Finish quarterly report'; });
  assert.strictEqual(report.done, false);
  assert.strictEqual(report.overdue, true);
  assert.deepStrictEqual(report.tags, ['report', 'urgent']);

  const bill = todos.find(function (t) { return t.title === 'Pay electricity bill'; });
  assert.strictEqual(bill.done, true);
  assert.ok(!bill.overdue);

  const open = await json(await api('GET', '/api/todos?done=0', { token: demo.token }));
  assert.strictEqual(open.length, 6);
  const work = await json(await api('GET', '/api/todos?list=2', { token: demo.token }));
  assert.strictEqual(work.length, 3);
});

test('todo CRUD: create, get, update, toggle, delete', async function () {
  const created = await api('POST', '/api/todos', {
    token: demo.token,
    body: { title: 'Smoke todo', notes: 'n', priority: 3, tags: ['a', 'b'] }
  });
  assert.strictEqual(created.status, 201);
  const todo = await json(created);
  assert.ok(todo.id > 8);
  assert.strictEqual(todo.title, 'Smoke todo');
  assert.strictEqual(todo.done, false);
  assert.strictEqual(todo.priority, 3);
  assert.deepStrictEqual(todo.tags, ['a', 'b']);
  assert.strictEqual(todo.user_id, 1);
  assert.strictEqual(todo.list_id, 1, 'defaults to the Inbox list');

  const got = await api('GET', '/api/todos/' + todo.id, { token: demo.token });
  assert.strictEqual(got.status, 200);
  assert.strictEqual((await json(got)).title, 'Smoke todo');

  const put = await api('PUT', '/api/todos/' + todo.id, {
    token: demo.token,
    body: { title: 'Smoke todo 2', done: true, list_id: 2, tags: 'x,y' }
  });
  assert.strictEqual(put.status, 200);
  const updated = await json(put);
  assert.strictEqual(updated.title, 'Smoke todo 2');
  assert.strictEqual(updated.done, true);
  assert.strictEqual(updated.list_id, 2);
  assert.deepStrictEqual(updated.tags, ['x', 'y']);
  assert.strictEqual(updated.notes, 'n', 'omitted fields are kept');

  const toggled = await api('POST', '/api/todos/' + todo.id + '/toggle', { token: demo.token });
  assert.strictEqual(toggled.status, 200);
  assert.deepStrictEqual(await json(toggled), { ok: true });
  const afterToggle = await json(await api('GET', '/api/todos/' + todo.id, { token: demo.token }));
  assert.strictEqual(afterToggle.done, false);

  const del = await api('DELETE', '/api/todos/' + todo.id, { token: demo.token });
  assert.strictEqual(del.status, 200);
  assert.deepStrictEqual(await json(del), { ok: true });
  const gone = await api('GET', '/api/todos/' + todo.id, { token: demo.token });
  assert.strictEqual(gone.status, 404);
  const delAgain = await api('DELETE', '/api/todos/' + todo.id, { token: demo.token });
  assert.strictEqual(delAgain.status, 404);
});

test('todo create without a title returns 400', async function () {
  const res = await api('POST', '/api/todos', { token: demo.token, body: { title: '   ' } });
  assert.strictEqual(res.status, 400);
});

test('register requires username and password', async function () {
  const res = await api('POST', '/api/users/register', { body: { username: 'nopass' } });
  assert.strictEqual(res.status, 400);
});

test('register returns a token, creates the Inbox list; duplicate username is 409', async function () {
  const res = await api('POST', '/api/users/register', {
    body: { username: 'smoke-user', password: 'pw', email: 's@example.com' }
  });
  assert.strictEqual(res.status, 200);
  const reg = await json(res);
  assert.ok(reg.token);
  assert.strictEqual(reg.user.username, 'smoke-user');
  assert.strictEqual(reg.user.email, 's@example.com');
  assert.ok(reg.user.id > 1);
  assert.strictEqual('password' in reg.user, false);

  const lists = await json(await api('GET', '/api/lists', { token: reg.token }));
  assert.strictEqual(lists.length, 1);
  assert.strictEqual(lists[0].name, 'Inbox');
  assert.strictEqual(lists[0].color, '#999999');
  assert.strictEqual(lists[0].total, 0);

  const dup = await api('POST', '/api/users/register', { body: { username: 'smoke-user', password: 'other' } });
  assert.strictEqual(dup.status, 409);
  const dupDemo = await api('POST', '/api/users/register', { body: { username: 'demo', password: 'x' } });
  assert.strictEqual(dupDemo.status, 409);

  // the registered user can log in and has empty stats
  const login = await api('POST', '/api/users/login', { body: { username: 'smoke-user', password: 'pw' } });
  assert.strictEqual(login.status, 200);
  const stats = await json(await api('GET', '/api/stats', { token: reg.token }));
  assert.deepStrictEqual(stats, { total: 0, done: 0, overdue: 0, dueToday: 0, tags: {}, percentDone: 0 });
});

test("another user's todo returns 404 on get, update and delete", async function () {
  const reg = await json(await api('POST', '/api/users/register', {
    body: { username: 'other-user', password: 'pw' }
  }));

  const mine = await json(await api('GET', '/api/todos', { token: reg.token }));
  assert.deepStrictEqual(mine, [], 'does not see the demo todos');

  const get = await api('GET', '/api/todos/1', { token: reg.token });
  assert.strictEqual(get.status, 404);
  const put = await api('PUT', '/api/todos/1', { token: reg.token, body: { title: 'hijack' } });
  assert.strictEqual(put.status, 404);
  const del = await api('DELETE', '/api/todos/1', { token: reg.token });
  assert.strictEqual(del.status, 404);

  const still = await json(await api('GET', '/api/todos/1', { token: demo.token }));
  assert.strictEqual(still.title, 'Buy milk');
});

test('lists: create, update, delete removes its todos, Inbox and unknown handled', async function () {
  const created = await api('POST', '/api/lists', { token: demo.token, body: { name: 'Temp', color: '#123456' } });
  assert.strictEqual(created.status, 200);
  const list = await json(created);
  assert.strictEqual(list.name, 'Temp');
  assert.strictEqual(list.color, '#123456');

  const noName = await api('POST', '/api/lists', { token: demo.token, body: {} });
  assert.strictEqual(noName.status, 400);

  const renamed = await api('PUT', '/api/lists/' + list.id, {
    token: demo.token,
    body: { name: 'Temp2', color: '#654321' }
  });
  assert.strictEqual(renamed.status, 200);
  assert.deepStrictEqual(await json(renamed), { ok: true });

  const t1 = await json(await api('POST', '/api/todos', { token: demo.token, body: { title: 'in temp 1', list_id: list.id } }));
  const t2 = await json(await api('POST', '/api/todos', { token: demo.token, body: { title: 'in temp 2', list_id: list.id } }));
  assert.strictEqual(t1.list_id, list.id);

  const lists = await json(await api('GET', '/api/lists', { token: demo.token }));
  const temp = lists.find(function (l) { return l.id === list.id; });
  assert.strictEqual(temp.name, 'Temp2');
  assert.strictEqual(temp.color, '#654321');
  assert.strictEqual(temp.total, 2);

  const del = await api('DELETE', '/api/lists/' + list.id, { token: demo.token });
  assert.strictEqual(del.status, 200);
  assert.deepStrictEqual(await json(del), { ok: true });

  for (const t of [t1, t2]) {
    const res = await api('GET', '/api/todos/' + t.id, { token: demo.token });
    assert.strictEqual(res.status, 404, 'todo of the deleted list is gone');
  }
  const after = await json(await api('GET', '/api/lists', { token: demo.token }));
  assert.strictEqual(after.some(function (l) { return l.id === list.id; }), false);

  const unknown = await api('DELETE', '/api/lists/99999', { token: demo.token });
  assert.strictEqual(unknown.status, 404);

  const inbox = await api('DELETE', '/api/lists/1', { token: demo.token });
  assert.strictEqual(inbox.status, 400);
  assert.deepStrictEqual(await json(inbox), { error: 'cannot delete Inbox' });
  const inboxStill = await json(await api('GET', '/api/lists', { token: demo.token }));
  assert.ok(inboxStill.some(function (l) { return l.id === 1 && l.name === 'Inbox'; }));
});

test('stats reflect todo changes and round percentDone', async function () {
  const before = await json(await api('GET', '/api/stats', { token: demo.token }));
  assert.strictEqual(before.total, 8);
  assert.strictEqual(before.done, 2);

  const created = await json(await api('POST', '/api/todos', {
    token: demo.token,
    body: { title: 'stats todo', tags: ['dev', 'new'] }
  }));
  await api('PUT', '/api/todos/' + created.id, { token: demo.token, body: { done: true } });

  const after = await json(await api('GET', '/api/stats', { token: demo.token }));
  assert.strictEqual(after.total, 9);
  assert.strictEqual(after.done, 3);
  assert.strictEqual(after.percentDone, 33); // round(3/9*100)
  assert.strictEqual(after.tags.dev, 3);
  assert.strictEqual(after.tags.new, 1);
});

test('logout invalidates the token; unknown and missing tokens are 401', async function () {
  const fresh = await backend.login('demo', 'demo');
  const ok = await api('GET', '/api/todos', { token: fresh.token });
  assert.strictEqual(ok.status, 200);

  const out = await api('POST', '/api/users/logout', { token: fresh.token });
  assert.strictEqual(out.status, 200);
  assert.deepStrictEqual(await json(out), { ok: true });

  const after = await api('GET', '/api/todos', { token: fresh.token });
  assert.strictEqual(after.status, 401);
  const again = await api('POST', '/api/users/logout', { token: fresh.token });
  assert.strictEqual(again.status, 401);

  const bogus = await api('GET', '/api/todos', { token: 'deadbeef' });
  assert.strictEqual(bogus.status, 401);
  const none = await api('GET', '/api/todos');
  assert.strictEqual(none.status, 401);

  // the earlier demo session is unaffected by logging out another one
  const still = await api('GET', '/api/todos', { token: demo.token });
  assert.strictEqual(still.status, 200);
});
