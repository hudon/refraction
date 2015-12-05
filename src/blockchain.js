'use strict';

const EventEmitter = require('events');
const bitcore = require('bitcore-lib');
const Insight = require('bitcore-explorers').Insight;
const request = require('request');

let insight = new Insight();

// Get confirmed balance of given address
function balance(address) {
  return new Promise(function (fulfill, reject) {
    insight.address(address, function(err, addr) {
      if (err) {
        reject(err);
      } else {
        fulfill(addr.balance);
      }
    });
  });
}

function unconfirmedBalance(address) {
  return new Promise(function (fulfill, reject) {
    insight.address(address, function(err, addr) {
      if (err) {
        reject(err);
      } else {
        fulfill(addr.unconfirmedBalance);
      }
    });
  });
}

function whenCoinsSentFromAddress(address) {
  const helper = function() {
    return spendingTransactions(address).then((inputs) => {
      if (inputs.length > 0) {
        return inputs;
      }
      else {
        return new Promise((resolve, reject) => {
          return setTimeout(() => helper().then(resolve, reject), 1000 * 15);
        });
      }
    });
  };
  return helper();
}

function fetchInputScript(txHash, index) {
  return fetchBlockCypherPath(`/txs/${txHash}`)
    .then((txData) => new bitcore.Script(txData.inputs[0].script));
}

function spendingTransactions(address) {
  return fetchBlockCypherAddress(address).then((addressData) => {
    return (addressData.txrefs || []).concat(addressData.unconfirmed_txrefs || [])
      .filter(({ tx_input_n }) => tx_input_n >= 0)
      .map(({ tx_hash, tx_input_n }) => {
        return { txHash: tx_hash, index: tx_input_n }
      });
  });
}

function fetchBlockCypherPath(path, params) {
  return new Promise((resolve, reject) => {
    request(getBlockCypherBaseURL() + path, (err, response, body) => {
      if (err) {
        reject(err);
      }
      else if (response.statusCode !== 200) {
        reject(`Received response code ${response.statusCode}`);
      }
      else {
        resolve(JSON.parse(body));
      }
    });
  });
}

function getBlockCypherBaseURL() {
  let network;
  if (bitcore.Networks.defaultNetwork == bitcore.Networks.testnet) {
    network = "test3";
  }
  else {
    network = "main";
  }
  return `https://api.blockcypher.com/v1/btc/${network}`;
}

function fetchBlockCypherAddress(address) {
  return fetchBlockCypherPath(`/addrs/${address}`);
}

// Polls for confirmed address balance
// Takes an optional timeout as a Date object
function whenAddressHasBalance(address, minimumBalance, timeout) {
  if (timeout == null)
    timeout = new Date("October 13, 3000 11:13:00");

  return new Promise((resolve) => setTimeout(resolve, 5 * 1000));

  const _addrLoop = function() {
    return balance(address).then((balance) => {
      if (balance >= minimumBalance) {
        return balance;
      }
      else {
        if (new Date() > timeout) {
          throw new Error(`Timeout while waiting for address ${address} to be funded`);
        }
        else {
          return new Promise((resolve, reject) => {
            setTimeout(() => _addrLoop().then(resolve, reject), 1000 * 15);
          });
        }
      }
    });
  }
  return _addrLoop();
}

// Broadcasts a Bitcore Transaction and returns the TxId
function broadcastTransaction(transaction) {
  let endpoint;
  if (bitcore.Networks.defaultNetwork = bitcore.Networks.testnet) {
    endpoint = 'https://testnet.blockexplorer.com/api/tx/send';
  }
  else {
    endpoint = 'https://blockexplorer.com/api/tx/send';
  }

  return new Promise((resolve, reject) => {
    request.post({ url: endpoint, body: { rawtx: transaction.toString() }, json: true }, (err, response, body) => {
      if (err) {
        reject(err);
      }
      else if (response.statusCode !== 200) {
        reject(`Received response code ${response.statusCode} ${body}`);
      }
      else {
        resolve();
      }
    });
  });
}

// Return all unspent outputs for a given address
// Returns an array of UnspentOutputs
function utxos(address) {
  return new Promise(function (fulfill, reject) {
    try {
      insight.getUnspentUtxos(address, function(err, utxos) {
        if (err) {
          reject(err);
        } else {
          fulfill(utxos);
        }
      });
    }
    catch (err) {
      reject(err);
    }
  });
}

exports.whenAddressHasBalance = whenAddressHasBalance;
exports.broadcastTransaction = broadcastTransaction;
exports.spendingTransactions = spendingTransactions;
exports.whenCoinsSentFromAddress = whenCoinsSentFromAddress;
exports.fetchInputScript = fetchInputScript;
exports.balance = balance;
exports.utxos = utxos;

// whenAddressHasBalance("1A66YkobmtQvGbq9jt5faw6nCE8tgjGgKT", 1000000000000, new Date(10 * 1000)).then(
//   function(bal){console.log("FULFILLED: " + bal)},
//   function(err){console.log("REJECTED: " + err)});

// broadcastTransaction("1A66YkobmtQvGbq9jt5faw6nCE8tgjGgKT").then(
//   function(bal){console.log("FULFILLED: " + bal)},
//   function(err){console.log("REJECTED: " + err)});
