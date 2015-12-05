const fairExchange = require('./index');

class BaseProtocol {
  await(message, handlerName) {
    return new Promise((resolve, reject) => {
      this.client.once(message, (data) => {
        try {
          resolve(this[handlerName].call(this, data));
        }
        catch(err) {
          this.client.send('error', { reason: err.message });
          reject(err);
        }
      });
    });
  }

  awaitWithTimeout(message, handlerName, endTime) {
    return new Promise((resolve, reject) => {
      let timedOut = false;

      const timeout = endTime - fairExchange.currentTime();
      if (timeout <= 0) {
        return reject("Timed out");
      }

      setTimeout(
        () => {
          timedOut = true;
          reject("Timed out");
        },
        timeout * 1000
      );

      this.client.once(message, (data) => {
        try {
          if (!timedOut) {
            resolve(this[handlerName].call(this, data));
          }
        }
        catch(err) {
          this.client.send('error', { reason: err.message });
          reject(err);
        }
      });
    });
  }
}

module.exports = BaseProtocol;
