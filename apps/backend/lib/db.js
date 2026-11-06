var sqlite3 = require('sqlite3').verbose();
var config = require('../config');

var db = new sqlite3.Database(config.dbFile);

db.serialize(function () {
  db.run('CREATE TABLE IF NOT EXISTS users (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    'username TEXT,' +
    'password TEXT,' +
    'email TEXT,' +
    'created_at TEXT)');

  db.run('CREATE TABLE IF NOT EXISTS tokens (' +
    'token TEXT,' +
    'user_id INTEGER,' +
    'expires TEXT)');

  db.run('CREATE TABLE IF NOT EXISTS lists (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    'user_id INTEGER,' +
    'name TEXT,' +
    'color TEXT,' +
    'created_at TEXT)');

  db.run('CREATE TABLE IF NOT EXISTS todos (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    'user_id INTEGER,' +
    'list_id INTEGER,' +
    'title TEXT,' +
    'notes TEXT,' +
    'done INTEGER DEFAULT 0,' +
    'priority INTEGER DEFAULT 2,' +
    'due_date TEXT,' +
    'tags TEXT,' +
    'created_at TEXT,' +
    'updated_at TEXT)');
});

module.exports = db;
