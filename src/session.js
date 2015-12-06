const bitcore = require('bitcore-lib');

const xim = require('./xim');
const fairExchange = require('./fairexchange');
const config = require('./refraction').config;
const blockchain = require('./blockchain');

class Session {
  constructor(payoutAddress, privateKeyIn) {
    this.payoutAddress = bitcore.Address.fromString(payoutAddress);
    // as soon as we have more than the minimum amount, we'll start refraction
    this.amount = 100000;
    this.privateKeyIn = privateKeyIn || new bitcore.PrivateKey();
  }

  start() {
    return blockchain.whenAddressHasBalance(
      this.privateKeyIn.toAddress(),
      this.amount,
      { includeUnconfirmed: config.acceptUnconfirmed }
    )
      .then(() => {
        console.log(`Received deposit transactions to address ${this.privateKeyIn.toAddress()}`);
        return xim.discover();
      })
      .then((peerClient) => {
        this.client = peerClient;
        return fairExchange.start(this);
      })
      .then(() => {
        console.log('Fair exchange complete!');
        return new Promise((resolve, reject) => {
          this.client.close(err => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
  }
}

module.exports = Session;
