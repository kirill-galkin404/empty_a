var express = require('express');
var moment = require('moment');
var async = require('async');
var db = require('../lib/db');
var auth = require('../lib/auth');

var router = express.Router();

router.use(auth.requireUser);

// GET /lists - lists with todo counts
router.get('/', function (req, res) {
  db.all('SELECT * FROM lists WHERE user_id = ? ORDER BY id', [req.user.id], function (err, lists) {
    if (err) return res.status(500).send(err);
    // N+1, fine for now
    async.map(lists, function (list, cb) {
      db.get('SELECT COUNT(*) as total, SUM(done) as done FROM todos WHERE list_id = ?', [list.id], function (err, row) {
        if (err) return cb(err);
        list.total = row.total;
        list.done = row.done || 0;
        cb(null, list);
      });
    }, function (err, result) {
      if (err) return res.status(500).send(err);
      res.send(result);
    });
  });
});

router.post('/', function (req, res) {
  if (!req.body.name) return res.status(400).send({ error: 'name required' });
  db.run('INSERT INTO lists (user_id, name, color, created_at) VALUES (?, ?, ?, ?)',
    [req.user.id, req.body.name, req.body.color || '#337ab7', moment().format()],
    function (err) {
      if (err) return res.status(500).send(err);
      db.get('SELECT * FROM lists WHERE id = ?', [this.lastID], function (err, list) {
        res.send(list);
      });
    });
});

router.put('/:id', function (req, res) {
  db.run('UPDATE lists SET name = ?, color = ? WHERE id = ? AND user_id = ?',
    [req.body.name, req.body.color, req.params.id, req.user.id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.send({ ok: true });
    });
});

// deleting a list deletes its todos too
router.delete('/:id', function (req, res) {
  db.get('SELECT * FROM lists WHERE id = ' + req.params.id, function (err, list) {
    if (err) return res.status(500).send(err);
    if (!list) return res.status(404).send({ error: 'not found' });
    if (list.name == 'Inbox') return res.status(400).send({ error: 'cannot delete Inbox' });
    db.run('DELETE FROM todos WHERE list_id = ' + list.id, function (err) {
      db.run('DELETE FROM lists WHERE id = ' + list.id, function (err) {
        res.send({ ok: true });
      });
    });
  });
});

module.exports = router;
