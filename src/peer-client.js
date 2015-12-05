const Socks = require('Socks');
const net = require('net');
const EventEmitter = require('events');

const EOL = '\n';

class PeerClient extends EventEmitter {
  constructor(options) {
    super();
    this._options = options;
  }

  _handleSocketEvents() {
    this._socket.setEncoding('utf8');

    this._buffer = '';

    this._socket.on('data', (data) => {
      console.log('PeerClient: Received data:', data);
      this._buffer += data;
      let i = this._buffer.indexOf(EOL);
      while (i !== -1) {
        const jsonStr = this._buffer.substring(0, i);
        let payload = {};
        try {
          payload = JSON.parse(jsonStr);
        } catch(err) {
          i = this._buffer.indexOf(EOL, i + 1);
          continue
        }
        this._buffer = this._buffer.substring(i + 1);
        this.emit(payload.message, payload.data);
        break;
      }
    });

    this._socket.on('error', (data) => {
      this.emit('error', data);
    });
  }

  _connect(options, callback) {
    var socksOptions = {
      proxy: {
        ipaddress: options.tor.ip,
        port: options.tor.port,
        type: 5
      },
      target: {
        host: options.destination,
        port: 80
      }
    };
    Socks.createConnection(socksOptions, (err, socket, info) => {
      if (err) {
        this.emit('error', err);
        return console.log('PeerClient:', err);
      }
      console.log('PeerClient: Alice: bob connected!');
      this._socket = socket;
      this._handleSocketEvents();
      this._socket.resume(); // socket is paused by Socks client
      callback();
    });
  }

  _listen(options, callback) {
    this._server = net.createServer((socket) => {
      console.log('PeerClient: Bob: Alice connected!');
      this._socket = socket;
      this._handleSocketEvents();
      callback();
    });

    this._server.listen(options.server.port, options.server.host, () => {
      console.log('PeerClient: Bob server listening');
    });
  }

  /*
   * Public API
   */
  init() {
    return new Promise((resolve) => {
      if (this._options.isAlice) {
        console.log('PeerClient: Creating a PeerClient for Alice');
        this._connect(this._options, resolve);
      } else {
        console.log('PeerClient: Creating a PeerClient for Bob');
        this._listen(this._options, resolve);
      }
    });
  }


  send(message, data, callback) {
    const payload = JSON.stringify({ message: message, data: data}) + EOL;
    console.log('PeerClient: Sending: ', payload);
    this._socket.write(payload, 'utf8', callback);
  }

  close(callback) {
    if (this._server) {
      this._socket.end(() => {
        this._server.close(callback)
      });
    } else {
      this._socket.end(callback)
    }
  }
}

module.exports = PeerClient;
