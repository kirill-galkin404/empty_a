var md5 = require('md5');
var moment = require('moment');
var db = require('./db');
var config = require('../config');

function hashPassword(pw) {
  return md5(pw + config.secret);
}

function makeToken(userId) {
  return md5(userId + '-' + Date.now() + '-' + Math.random());
}

// express middleware
function requireUser(req, res, next) {
  var token = req.headers['x-auth-token'] || req.query.token;
  if (!token) {
    return res.status(401).send({ error: 'no token' });
  }
  db.get('SELECT * FROM tokens WHERE token = ?', [token], function (err, row) {
    if (err) {
      console.log(err);
      return res.status(500).send('db error');
    }
    if (!row) {
      return res.status(401).send({ error: 'bad token' });
    }
    if (moment(row.expires).isBefore(moment())) {
      return res.status(401).json({ message: 'token expired' });
    }
    db.get('SELECT * FROM users WHERE id = ' + row.user_id, function (err, user) {
      if (err || !user) {
        return res.status(401).send({ error: 'user not found' });
      }
      req.user = user;
      next();
    });
  });
}

module.exports = {
  hashPassword: hashPassword,
  makeToken: makeToken,
  requireUser: requireUser
};
