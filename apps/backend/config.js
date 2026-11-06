// TODO move to env vars
module.exports = {
  port: 3000,
  dbFile: __dirname + '/todo.db',
  secret: 'supersecret123',
  tokenTtlHours: 24,
  allowOrigin: '*',
  pageSize: 20
};
