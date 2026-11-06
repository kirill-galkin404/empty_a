'use strict';
// Preloaded (node --require) into the test backend so that listen(port, cb)
// binds to 127.0.0.1 only, without changing apps/backend/server.js.
const net = require('net');
const origListen = net.Server.prototype.listen;

net.Server.prototype.listen = function () {
  const args = Array.prototype.slice.call(arguments);
  if ((typeof args[0] === 'number' || typeof args[0] === 'string') && typeof args[1] !== 'string') {
    args.splice(1, 0, '127.0.0.1');
  }
  return origListen.apply(this, args);
};
