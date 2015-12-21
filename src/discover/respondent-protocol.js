'use strict';

const blockchain = require('../blockchain');
const BaseProtocol = require('../base-protocol');
const Ad = require('../ad');
const transactionGenerator = require('./transaction-generator');

class RespondentProtocol extends BaseProtocol {
  constructor() {
  }

  start() {
    // wait Y time units
    // select random ad
    // ping and match advertiser
    // publish match tx
    // wait confirm tx
    // start fairexchange
  }
}

module.exports = AdvertiserProtocol;
