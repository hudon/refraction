'use strict';

const async = require('async');
const EventEmitter = require('events');
const bitcore = require('bitcore-lib');
const request = require('request');
const Socks = require('socks');
const _ = require('lodash');

const config = require('./refraction').config;

const DEFAULT_POLL_INTERVAL = 15;

function balance(address, options) {
  options = options || {};
  return addressInfo(address).then((data) => {
    if (options.includeUnconfirmed) {
      return data.balanceSat + data.unconfirmedBalanceSat;
    }
    else {
      return data.balanceSat;
    }
  });
}

// Broadcasts a Bitcore Transaction and returns the TxId
function broadcast(transaction) {
  return postPath("/tx/send", { rawtx: transaction.toString() }).then(() => transaction.hash);
}

// Return all unspent outputs for a given address
// Returns an array of UnspentOutputs
function utxos(address) {
  return fetchPath(`/addr/${address.toString()}/utxo`).then((response) => {
    return response.map((utxoData) => bitcore.Transaction.UnspentOutput(utxoData));
  });
}

function transaction(txHash) {
  return fetchPath(`/rawtx/${txHash}`).then((response) => new bitcore.Transaction(response.rawtx));
}

function addressInfo(address) {
  return fetchPath(`/addr/${address.toString()}`);
};

function whenCoinsSentFromAddress(address, options) {
  options = options || {};
  const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;

  const transactionsChecked = [];
  const checkTransactions = () => {
    if (options.timeout && new Date() > options.timeout) {
      throw new Error(`Timeout while waiting for address ${address} to be funded`);
    }

    return addressInfo(address).then((data) => {
      return new Promise((resolve, reject) => {
        const transactionsUnchecked = _.difference(data.transactions, transactionsChecked);
        async.map(
          transactionsUnchecked,
          (txHash, callback) => {
            fetchPath(`/tx/${txHash}`)
              .then((transactionDetails) => callback(null, transactionDetails))
              .catch(callback);
          },
          (err, transactionsDetails) => {
            for (let transactionDetails of transactionsDetails) {
              transactionsChecked.push(transactionDetails.txid);
              for (let input of transactionDetails.vin) {
                if (input.addr === address.toString()) {
                  return resolve({ txHash: transactionDetails.txid, index: input.n });
                }
              }
            }
            setTimeout(() => checkTransactions().then(resolve, reject), pollInterval * 1000);
          }
        );
      });
    });
  };
  return checkTransactions();
}

// Polls for confirmed address balance
// Takes an optional timeout as a Date object
function whenAddressHasBalance(address, minimumBalance, options) {
  options = options || {};
  const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;

  const checkBalance = () => {
    if (options.timeout && new Date() > options.timeout) {
      throw new Error(`Timeout while waiting for address ${address} to be funded`);
    }

    return balance(address, { includeUnconfirmed: options.includeUnconfirmed }).then((balance) => {
      if (balance >= minimumBalance) {
        return;
      }
      else {
        return new Promise((resolve, reject) => {
          setTimeout(() => checkBalance().then(resolve, reject), pollInterval * 1000);
        });
      }
    });
  };
  return checkBalance();
}

function fetchPath(path, params) {
  const options = {
    url: config.insightUrl + "/api" + path,
    qs: params,
    agent: socksAgent()
  };
  return new Promise((resolve, reject) => {
    request.get(options, (err, response, body) => {
      if (err) {
        reject(err);
      }
      else if (response.statusCode !== 200) {
        reject(`Received response code ${response.statusCode}: ${response.body}`);
      }
      else {
        resolve(JSON.parse(body));
      }
    });
  });
}

function postPath(path, params) {
  const options = {
    url: config.insightUrl + "/api" + path,
    body: params,
    json: true,
    agent: socksAgent()
  };
  return new Promise((resolve, reject) => {
    request.post(options, (err, response, body) => {
      if (err) {
        reject(err);
      }
      else if (response.statusCode !== 200) {
        reject(`Received response code ${response.statusCode}: ${response.body}`);
      }
      else {
        const parsedBody = typeof(body) === 'object' ? body : JSON.parse(body);
        resolve(parsedBody);
      }
    });
  });
}

function socksAgent() {
  const agent = new Socks.Agent(
    {
      proxy: {
        ipaddress: config.tor.ip,
        port: config.tor.port,
        type: 5
      }
    },
    true  // HTTPS
  );
}

exports.balance = balance;
exports.broadcast = broadcast;
exports.transaction = transaction;
exports.utxos = utxos;
exports.whenCoinsSentFromAddress = whenCoinsSentFromAddress;
exports.whenAddressHasBalance = whenAddressHasBalance;
