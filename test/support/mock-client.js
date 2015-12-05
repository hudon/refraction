const EventEmitter = require('events').EventEmitter;

class MockClient extends EventEmitter {
  send(message, data) {
    process.nextTick(this.emit.bind(this, message, data));
  }
}

module.exports = MockClient;
