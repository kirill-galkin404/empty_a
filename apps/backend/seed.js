// creates demo user (demo / demo) with some todos
var moment = require('moment');
var db = require('./lib/db');
var auth = require('./lib/auth');

var now = moment().format();

db.serialize(function () {
  db.run('DELETE FROM todos');
  db.run('DELETE FROM lists');
  db.run('DELETE FROM tokens');
  db.run('DELETE FROM users');

  db.run('INSERT INTO users (id, username, password, email, created_at) VALUES (1, ?, ?, ?, ?)',
    ['demo', auth.hashPassword('demo'), 'demo@example.com', now]);

  db.run("INSERT INTO lists (id, user_id, name, color, created_at) VALUES (1, 1, 'Inbox', '#999999', ?)", [now]);
  db.run("INSERT INTO lists (id, user_id, name, color, created_at) VALUES (2, 1, 'Work', '#d9534f', ?)", [now]);
  db.run("INSERT INTO lists (id, user_id, name, color, created_at) VALUES (3, 1, 'Home', '#5cb85c', ?)", [now]);

  var todos = [
    [1, 'Buy milk', '', 0, 1, moment().format('YYYY-MM-DD'), 'shopping'],
    [1, 'Call mom', '', 0, 2, null, 'family'],
    [2, 'Finish quarterly report', 'needs numbers from finance', 0, 3, moment().subtract(2, 'days').format('YYYY-MM-DD'), 'report,urgent'],
    [2, 'Code review for Bob', '', 1, 2, null, 'dev'],
    [2, 'Update dependencies', 'everything is so old...', 0, 1, moment().add(7, 'days').format('YYYY-MM-DD'), 'dev,tech-debt'],
    [3, 'Fix the kitchen tap', '', 0, 2, moment().add(3, 'days').format('YYYY-MM-DD'), 'repair'],
    [3, 'Pay electricity bill', '', 1, 3, moment().subtract(5, 'days').format('YYYY-MM-DD'), 'bills'],
    [3, 'Water the plants', '', 0, 1, null, '']
  ];
  todos.forEach(function (t) {
    db.run('INSERT INTO todos (user_id, list_id, title, notes, done, priority, due_date, tags, created_at, updated_at) VALUES (1,?,?,?,?,?,?,?,?,?)',
      [t[0], t[1], t[2], t[3], t[4], t[5], t[6], now, now]);
  });
});

db.close(function () {
  console.log('seeded. login with demo / demo');
});
