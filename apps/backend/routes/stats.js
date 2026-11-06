var express = require('express');
var moment = require('moment');
var async = require('async');
var _ = require('lodash');
var db = require('../lib/db');
var auth = require('../lib/auth');

var router = express.Router();

router.get('/', auth.requireUser, function (req, res) {
  var userId = req.user.id;
  var today = moment().format('YYYY-MM-DD');

  async.parallel({
    total: function (cb) {
      db.get('SELECT COUNT(*) as c FROM todos WHERE user_id = ?', [userId], function (err, r) { cb(err, r && r.c); });
    },
    done: function (cb) {
      db.get('SELECT COUNT(*) as c FROM todos WHERE user_id = ? AND done = 1', [userId], function (err, r) { cb(err, r && r.c); });
    },
    overdue: function (cb) {
      db.get('SELECT COUNT(*) as c FROM todos WHERE user_id = ? AND done = 0 AND due_date < ?', [userId, today], function (err, r) { cb(err, r && r.c); });
    },
    dueToday: function (cb) {
      db.get('SELECT COUNT(*) as c FROM todos WHERE user_id = ? AND done = 0 AND substr(due_date, 1, 10) = ?', [userId, today], function (err, r) { cb(err, r && r.c); });
    },
    tags: function (cb) {
      // tags are stored comma separated, so count them in JS
      db.all('SELECT tags FROM todos WHERE user_id = ?', [userId], function (err, rows) {
        if (err) return cb(err);
        var all = _.flatten(_.map(rows, function (r) { return r.tags ? r.tags.split(',') : []; }));
        var counts = _.countBy(_.compact(_.map(all, _.trim)));
        cb(null, counts);
      });
    }
  }, function (err, result) {
    if (err) return res.status(500).send(err);
    result.percentDone = result.total ? Math.round(result.done / result.total * 100) : 0;
    res.send(result);
  });
});

module.exports = router;
