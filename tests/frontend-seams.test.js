'use strict';
// Seam tests for apps/frontend: AngularJS code is loaded into a node:vm
// context with a minimal fake `angular` global. No dependencies, no browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FRONTEND = path.join(__dirname, '..', 'apps', 'frontend');
// Objects created inside the vm context have a different realm's prototypes.
const plain = (v) => JSON.parse(JSON.stringify(v));
const read = (rel) => fs.readFileSync(path.join(FRONTEND, rel), 'utf8');

function makeStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}

function load(files, storageInit) {
  const registry = { config: [], run: [], factory: {}, service: {}, controller: {}, filter: {} };
  const localStorage = makeStorage(storageInit);
  const fakeModule = {
    config(fn) { registry.config.push(fn); return fakeModule; },
    run(fn) { registry.run.push(fn); return fakeModule; },
    factory(name, fn) { registry.factory[name] = fn; return fakeModule; },
    service(name, fn) { registry.service[name] = fn; return fakeModule; },
    controller(name, fn) { registry.controller[name] = fn; return fakeModule; },
    filter(name, fn) { registry.filter[name] = fn; return fakeModule; },
    directive() { return fakeModule; },
    constant() { return fakeModule; },
    value() { return fakeModule; }
  };
  const modules = [];
  const sandbox = {
    angular: { module(name, deps) { modules.push({ name, deps }); return fakeModule; } },
    localStorage,
    console
  };
  const ctx = vm.createContext(sandbox);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return { ctx, registry, localStorage, modules };
}

// Invoke an annotated array ['dep', ..., fn] with the given injectables.
function invoke(annotated, locals) {
  const fn = annotated[annotated.length - 1];
  const deps = annotated.slice(0, -1);
  return fn.apply(null, deps.map((d) => {
    assert.ok(d in locals, 'missing stub for injectable ' + d);
    return locals[d];
  }));
}

function makeLocation() {
  return { paths: [], path(p) { if (p !== undefined) this.paths.push(p); return this; } };
}

const $q = { reject: (r) => ({ rejected: true, reason: r }) };

test('API_URL defaults to http://localhost:3000/api', () => {
  const { ctx } = load(['js/config.js']);
  assert.equal(vm.runInContext('API_URL', ctx), 'http://localhost:3000/api');
});

test('app module is todoApp with ngRoute', () => {
  const { modules } = load(['js/app.js']);
  assert.equal(modules[0].name, 'todoApp');
  assert.deepEqual(plain(modules[0].deps), ['ngRoute']);
});

test('config registers routes, otherwise redirect to /todos and authInterceptor', () => {
  const { registry } = load(['js/app.js']);
  assert.equal(registry.config.length, 1);
  const routes = {};
  let otherwise;
  const $routeProvider = {
    when(p, def) { routes[p] = def; return this; },
    otherwise(def) { otherwise = def; return this; }
  };
  const interceptors = [];
  invoke(registry.config[0], { $routeProvider, $httpProvider: { interceptors } });
  assert.deepEqual(Object.keys(routes).sort(),
    ['/login', '/register', '/settings', '/stats', '/todos', '/todos/:id']);
  assert.equal(routes['/login'].templateUrl, 'views/login.html');
  assert.equal(routes['/register'].templateUrl, 'views/register.html');
  assert.equal(routes['/todos'].templateUrl, 'views/todos.html');
  assert.deepEqual(plain(otherwise), { redirectTo: '/todos' });
  assert.deepEqual(plain(interceptors), ['authInterceptor']);
});

function routeGuard(storageInit) {
  const env = load(['js/app.js'], storageInit);
  const $location = makeLocation();
  let handler, eventName;
  const $rootScope = { $on(name, fn) { eventName = name; handler = fn; } };
  assert.equal(env.registry.run.length, 1);
  invoke(env.registry.run[0], { $rootScope, $location });
  assert.equal(eventName, '$routeChangeStart');
  return { handler, $location, localStorage: env.localStorage };
}

test('route guard redirects to /login without token for guarded templates', () => {
  const g = routeGuard();
  for (const t of ['views/todos.html', 'views/todo-edit.html', 'views/stats.html', 'views/settings.html']) {
    g.handler({}, { templateUrl: t });
  }
  assert.deepEqual(g.$location.paths, ['/login', '/login', '/login', '/login']);
});

test('route guard lets login and register through without token', () => {
  const g = routeGuard();
  g.handler({}, { templateUrl: 'views/login.html' });
  g.handler({}, { templateUrl: 'views/register.html' });
  assert.deepEqual(g.$location.paths, []);
});

test('route guard ignores routes without templateUrl (otherwise redirect)', () => {
  const g = routeGuard();
  g.handler({}, { redirectTo: '/todos' });
  g.handler({}, {});
  assert.deepEqual(g.$location.paths, []);
});

test('route guard does not redirect when a token exists', () => {
  const g = routeGuard({ token: 'abc' });
  g.handler({}, { templateUrl: 'views/todos.html' });
  assert.deepEqual(g.$location.paths, []);
});

function interceptor(storageInit) {
  const env = load(['js/config.js', 'js/app.js', 'js/services.js'], storageInit);
  const $location = makeLocation();
  const $rootScope = { currentUser: { username: 'u' } };
  const svc = invoke(env.registry.factory.authInterceptor, { $q, $location, $rootScope });
  return { svc, $location, $rootScope, localStorage: env.localStorage };
}

test('authInterceptor.request sets X-Auth-Token from localStorage', () => {
  const i = interceptor({ token: 'tok123' });
  const cfg = i.svc.request({ headers: {} });
  assert.equal(cfg.headers['X-Auth-Token'], 'tok123');
});

test('authInterceptor.request omits X-Auth-Token when no token', () => {
  const i = interceptor();
  const cfg = i.svc.request({ headers: {} });
  assert.equal('X-Auth-Token' in cfg.headers, false);
});

test('authInterceptor.responseError on 401 clears session, redirects and rejects', () => {
  const i = interceptor({ token: 't', user: '{"username":"u"}' });
  const rejection = { status: 401 };
  const result = i.svc.responseError(rejection);
  assert.equal(i.localStorage.getItem('token'), null);
  assert.equal(i.localStorage.getItem('user'), null);
  assert.equal(i.$rootScope.currentUser, null);
  assert.deepEqual(i.$location.paths, ['/login']);
  assert.deepEqual(result, { rejected: true, reason: rejection });
});

test('authInterceptor.responseError on other statuses does not clear session', () => {
  for (const status of [400, 403, 404, 500]) {
    const i = interceptor({ token: 't', user: '{"username":"u"}' });
    const rejection = { status };
    const result = i.svc.responseError(rejection);
    assert.equal(i.localStorage.getItem('token'), 't');
    assert.equal(i.localStorage.getItem('user'), '{"username":"u"}');
    assert.deepEqual(i.$rootScope.currentUser, { username: 'u' });
    assert.deepEqual(i.$location.paths, []);
    assert.deepEqual(result, { rejected: true, reason: rejection });
  }
});

test('index.html keeps CDN tags and script order', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(scripts, [
    'https://code.jquery.com/jquery-1.12.4.min.js',
    'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js',
    'https://ajax.googleapis.com/ajax/libs/angularjs/1.5.8/angular.min.js',
    'https://ajax.googleapis.com/ajax/libs/angularjs/1.5.8/angular-route.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js',
    'js/config.js',
    'js/app.js',
    'js/services.js',
    'js/filters.js',
    'js/controllers.js'
  ]);
  assert.match(html, /<link rel="stylesheet" href="https:\/\/maxcdn\.bootstrapcdn\.com\/bootstrap\/3\.3\.7\/css\/bootstrap\.min\.css">/);
  assert.match(html, /<link rel="stylesheet" href="css\/style\.css">/);
  assert.match(html, /<html ng-app="todoApp">/);
  assert.match(html, /<div ng-view><\/div>/);
});
