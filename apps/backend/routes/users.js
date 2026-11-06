var express = require('express');
var moment = require('moment');
var db = require('../lib/db');
var auth = require('../lib/auth');
var config = require('../config');

var router = express.Router();

router.post('/register', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;

  if (!username || !password) {
    return res.status(400).send({ error: 'username and password required' });
  }

  db.get('SELECT id FROM users WHERE username = ?', [username], function (err, row) {
    if (err) return res.status(500).send(err);
    if (row) return res.status(409).send({ error: 'user exists' });

    db.run('INSERT INTO users (username, password, email, created_at) VALUES (?, ?, ?, ?)',
      [username, auth.hashPassword(password), email, moment().format()],
      function (err) {
        if (err) return res.status(500).send(err);
        var userId = this.lastID;
        // create default list for new user
        db.run('INSERT INTO lists (user_id, name, color, created_at) VALUES (?, ?, ?, ?)',
          [userId, 'Inbox', '#999999', moment().format()],
          function (err) {
            if (err) console.log('could not create inbox', err);
            var token = auth.makeToken(userId);
            db.run('INSERT INTO tokens (token, user_id, expires) VALUES (?, ?, ?)',
              [token, userId, moment().add(config.tokenTtlHours, 'hours').format()],
              function (err) {
                if (err) return res.status(500).send(err);
                res.send({ token: token, user: { id: userId, username: username, email: email } });
              });
          });
      });
  });
});

router.post('/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  db.get('SELECT * FROM users WHERE username = ? AND password = ?',
    [username, auth.hashPassword(password)],
    function (err, user) {
      if (err) return res.status(500).send(err);
      if (!user) return res.status(401).send({ error: 'wrong username or password' });

      var token = auth.makeToken(user.id);
      db.run('INSERT INTO tokens (token, user_id, expires) VALUES (?, ?, ?)',
        [token, user.id, moment().add(config.tokenTtlHours, 'hours').format()],
        function (err) {
          if (err) return res.status(500).send(err);
          delete user.password;
          res.send({ token: token, user: user });
        });
    });
});

router.post('/logout', auth.requireUser, function (req, res) {
  var token = req.headers['x-auth-token'] || req.query.token;
  db.run("DELETE FROM tokens WHERE token = '" + token + "'", function () {
    res.send({ ok: true });
  });
});

router.get('/me', auth.requireUser, function (req, res) {
  var u = req.user;
  res.send({ id: u.id, username: u.username, email: u.email, created_at: u.created_at });
});

router.put('/me', auth.requireUser, function (req, res) {
  var email = req.body.email;
  var password = req.body.password;
  if (password) {
    db.run('UPDATE users SET email = ?, password = ? WHERE id = ?',
      [email, auth.hashPassword(password), req.user.id], function (err) {
        if (err) return res.status(500).send(err);
        res.send({ ok: true });
      });
  } else {
    db.run('UPDATE users SET email = ? WHERE id = ?', [email, req.user.id], function (err) {
      if (err) return res.status(500).send(err);
      res.send({ ok: true });
    });
  }
});

module.exports = router;
