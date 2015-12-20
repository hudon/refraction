'use strict';

const blockchain = require('../blockchain');
const BaseProtocol = require('../base-protocol');
const Ad = require('../ad');
const transactionGenerator = require('./transaction-generator');

class AdvertiserProtocol extends BaseProtocol {
  constructor() {
    this.ad = new Ad();
  }

  start() {
    return transactionGenerator.makeAdTransaction(ad)
      .then((transaction) => {
        return blockchain.broadcast(transaction).then(() => transaction);
      })
      .then((transaction) => {
        // wait X time units
        // select from respondents
        // ping respondent
        // wait for response on blockchain
        // publish confirm ad
        // start fairexchange
      });
  }
}

module.exports = AdvertiserProtocol;
