var express = require('express');
var moment = require('moment');
var _ = require('lodash');
var db = require('../lib/db');
var auth = require('../lib/auth');
var config = require('../config');

var router = express.Router();

router.use(auth.requireUser);

function formatTodo(t) {
  t.done = t.done == 1;
  t.tags = t.tags ? t.tags.split(',') : [];
  t.overdue = !t.done && t.due_date && moment(t.due_date).isBefore(moment(), 'day');
  return t;
}

// GET /todos?list=1&done=0&q=milk&tag=home&sort=due&page=1
router.get('/', function (req, res) {
  var sql = 'SELECT * FROM todos WHERE user_id = ' + req.user.id;
  if (req.query.list) {
    sql += ' AND list_id = ' + req.query.list;
  }
  if (req.query.done === '0' || req.query.done === '1') {
    sql += ' AND done = ' + req.query.done;
  }
  if (req.query.q) {
    sql += " AND (title LIKE '%" + req.query.q + "%' OR notes LIKE '%" + req.query.q + "%')";
  }
  if (req.query.tag) {
    sql += " AND tags LIKE '%" + req.query.tag + "%'";
  }
  if (req.query.sort == 'due') {
    sql += ' ORDER BY due_date IS NULL, due_date ASC';
  } else if (req.query.sort == 'priority') {
    sql += ' ORDER BY priority DESC';
  } else {
    sql += ' ORDER BY id DESC';
  }
  var page = parseInt(req.query.page) || 1;
  sql += ' LIMIT ' + config.pageSize + ' OFFSET ' + (page - 1) * config.pageSize;

  db.all(sql, function (err, rows) {
    if (err) {
      console.log(sql);
      return res.status(500).send(err);
    }
    res.send(_.map(rows, formatTodo));
  });
});

router.get('/:id', function (req, res) {
  db.get('SELECT * FROM todos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err, row) {
    if (err) return res.status(500).send(err);
    if (!row) return res.status(404).send({ error: 'not found' });
    res.send(formatTodo(row));
  });
});

router.post('/', function (req, res) {
  var b = req.body;
  if (!b.title || b.title.trim() == '') {
    return res.status(400).send({ error: 'title required' });
  }
  var tags = _.isArray(b.tags) ? b.tags.join(',') : (b.tags || '');
  var now = moment().format();

  var insert = function (listId) {
    db.run('INSERT INTO todos (user_id, list_id, title, notes, done, priority, due_date, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, listId, b.title, b.notes || '', 0, b.priority || 2, b.due_date || null, tags, now, now],
      function (err) {
        if (err) return res.status(500).send(err);
        db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], function (err, row) {
          res.status(201).send(formatTodo(row));
        });
      });
  };

  if (b.list_id) {
    insert(b.list_id);
  } else {
    // put into Inbox
    db.get("SELECT id FROM lists WHERE user_id = ? AND name = 'Inbox'", [req.user.id], function (err, list) {
      insert(list ? list.id : null);
    });
  }
});

router.put('/:id', function (req, res) {
  db.get('SELECT * FROM todos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err, todo) {
    if (err) return res.status(500).send(err);
    if (!todo) return res.status(404).send({ error: 'not found' });

    var b = req.body;
    var updated = {
      title: b.title !== undefined ? b.title : todo.title,
      notes: b.notes !== undefined ? b.notes : todo.notes,
      done: b.done !== undefined ? (b.done ? 1 : 0) : todo.done,
      priority: b.priority !== undefined ? b.priority : todo.priority,
      due_date: b.due_date !== undefined ? b.due_date : todo.due_date,
      list_id: b.list_id !== undefined ? b.list_id : todo.list_id,
      tags: b.tags !== undefined ? (_.isArray(b.tags) ? b.tags.join(',') : b.tags) : todo.tags
    };

    db.run('UPDATE todos SET title=?, notes=?, done=?, priority=?, due_date=?, list_id=?, tags=?, updated_at=? WHERE id=?',
      [updated.title, updated.notes, updated.done, updated.priority, updated.due_date, updated.list_id, updated.tags, moment().format(), todo.id],
      function (err) {
        if (err) return res.status(500).send(err);
        db.get('SELECT * FROM todos WHERE id = ?', [todo.id], function (err, row) {
          res.send(formatTodo(row));
        });
      });
  });
});

router.post('/:id/toggle', function (req, res) {
  db.run('UPDATE todos SET done = 1 - done, updated_at = ? WHERE id = ' + req.params.id, [moment().format()], function (err) {
    if (err) return res.status(500).send(err);
    res.send({ ok: true });
  });
});

router.delete('/:id', function (req, res) {
  db.run('DELETE FROM todos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).send(err);
    if (this.changes == 0) return res.status(404).send({ error: 'not found' });
    res.send({ ok: true });
  });
});

// bulk: mark all done / delete done in a list
router.post('/bulk', function (req, res) {
  var action = req.body.action;
  var listId = req.body.list_id;
  if (action == 'complete_all') {
    db.run('UPDATE todos SET done = 1 WHERE user_id = ? AND list_id = ?', [req.user.id, listId], function (err) {
      if (err) return res.status(500).send(err);
      res.send({ ok: true, changed: this.changes });
    });
  } else if (action == 'clear_done') {
    db.run('DELETE FROM todos WHERE user_id = ? AND list_id = ? AND done = 1', [req.user.id, listId], function (err) {
      if (err) return res.status(500).send(err);
      res.send({ ok: true, changed: this.changes });
    });
  } else {
    res.status(400).send('unknown action');
  }
});

module.exports = router;
