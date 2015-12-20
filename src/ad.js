const crypto = require('crypto');

class Ad {
  constructor({ amount, mixFee, privateKey }) {
    super();
    this.amount = amount;
    this.mixFee = mixFee;
    this.published = false;
    this.nonce = crypto.randomBytes(16);
    this.privateKey = privateKey;
  }

}

module.exports = Ad;
