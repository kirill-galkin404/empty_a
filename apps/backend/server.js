var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var config = require('./config');

var app = express();

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', config.allowOrigin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Auth-Token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method == 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/', function (req, res) {
  res.send('todo api is running');
});

app.use('/api/users', require('./routes/users'));
app.use('/api/lists', require('./routes/lists'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/stats', require('./routes/stats'));

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(process.env.PORT || config.port, function () {
  console.log('Todo API listening on port ' + (process.env.PORT || config.port));
});
