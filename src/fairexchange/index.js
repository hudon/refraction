'use strict';

const async = require('async');
const bitcore = require('bitcore-lib');
const crypto = require('crypto');
const _ = require('lodash');

const refraction = require('../refraction');
const BobProtocol = require('./bob-protocol');
const AliceProtocol = require('./alice-protocol');

function start(session) {
  let protocolClass;
  if (refraction.config.isAlice) {
    protocolClass = AliceProtocol;
  }
  else {
    protocolClass = BobProtocol;
  }
  const protocol = new protocolClass({
    client: session.client,
    amount: session.amount,
    privateKeyIn: session.privateKeyIn,
    outAddress: session.payoutAddress
  });
  return protocol.start();
}

function currentTime() {
  return Math.floor((new Date()).getTime() / 1000);
}

// Generate n 256 bit secrets
function generateSecrets(n) {
  return new Promise((resolve, reject) => {
    async.times(
      n,
      (_i, next) => crypto.randomBytes(32, next),
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    )
  });
}

function hash(buffer) {
  return bitcore.crypto.Hash.sha256sha256(buffer);
}

function pickIndices(n, m) {
  return _.take(_.shuffle(_.range(n)), m);
};

exports.currentTime = currentTime;
exports.generateSecrets = generateSecrets;
exports.hash = hash;
exports.pickIndices = pickIndices;
exports.start = start;
