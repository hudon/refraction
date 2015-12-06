'use strict';

const bitcore = require('bitcore-lib');
const bufferMath = require('math-buffer');
const _ = require('lodash');

const blockchain = require('../blockchain');
const fairExchange = require('./index');
const transactionGenerator = require('./transaction-generator');
const BaseProtocol = require('./base-protocol');

const ALICE_TIMEOUT = 1 * 60 * 60;  // One hour
const BOB_TIMEOUT = 2 * 60 * 60;  // Two hours
const N = 100;
const M = 95;

class BobProtocol extends BaseProtocol {
  constructor({ client, amount, privateKeyIn, outAddress }) {
    super();
    this.client = client;
    this.amount = amount;
    this.prvkeyB0 = privateKeyIn;
    this.addressB0 = this.prvkeyB0.toAddress();
    this.changeAddress = this.addressB0;
    this.outAddress = outAddress;
  }

  start() {
    return this.await('hello', 'handleHello');
  }

  handleHello({ address, amount }) {
    console.log(`Received hello message with address ${address}`);

    if (amount !== this.amount) {
      throw new Error(`Amount must be ${this.amount}`);
    }
    if (blockchain.balance(address) < this.amount) {
      throw new Error("Address has insufficient balance");
    }

    this.addressA0 = new bitcore.Address.fromString(address);

    const currentTime = fairExchange.currentTime();
    this.aliceLockTime = currentTime + ALICE_TIMEOUT;
    this.bobLockTime = currentTime + BOB_TIMEOUT;
    this.n = N;
    this.m = M;

    this.client.send('params', {
      aliceLockTime: this.aliceLockTime,
      bobLockTime: this.bobLockTime,
      address: this.addressB0,
      n: this.n,
      m: this.m
    });
    return this.await('secrets', 'handleSecrets');
  }

  handleSecrets({ pubkeyA1, pubkeyA2, secretsA }) {
    console.log(`Received secrets and pubkeys from peer`);

    this.secretsA = secretsA.map((secret) => new Buffer(secret, 'hex'));

    if (this.secretsA.length !== this.n) {
      throw new Error(`Did not receive ${this.n} secrets`);
    }
    // TODO: Check size/entropy of Alice secrets

    this.pubkeyA1 = new bitcore.PublicKey(pubkeyA1);
    this.pubkeyA2 = new bitcore.PublicKey(pubkeyA2);
    this.prvkeyB1 = new bitcore.PrivateKey();
    this.prvkeyB2 = new bitcore.PrivateKey();

    return fairExchange.generateSecrets(this.n).then((secretsB) => {
      this.secretsB = secretsB;

      this.secretsAB = [];
      this.hashesAB = [];
      this.hashesB = [];
      for (let i = 0; i < this.n; i++) {
        const sum = new Buffer(32);
        bufferMath.add(this.secretsA[i], this.secretsB[i], sum);
        this.secretsAB.push(sum);
        this.hashesAB.push(fairExchange.hash(sum));
        this.hashesB.push(fairExchange.hash(this.secretsB[i]));
      }

      this.client.send('hashes', {
        hashesAB: this.hashesAB.map((hash) => hash.toString('hex')),
        hashesB: this.hashesB.map((hash) => hash.toString('hex')),
        pubkeyB1: this.prvkeyB1.toPublicKey().toString(),
        pubkeyB2: this.prvkeyB2.toPublicKey().toString()
      });
      return this.await('challenge', 'handleChallenge');
    });
  }

  handleChallenge({ indices }) {
    console.log(`Received challenge indices from peer`);

    this.indices = indices;
    this.invIndices = _.difference(_.range(this.n), this.indices);

    if (this.indices.length !== this.m) {
      throw new Error(`Did not receive ${this.m} indices`);
    }
    if (this.indices.length !== _.uniq(this.indices).length) {
      throw new Error("Indices contains duplicate values");
    }

    const selectedSecrets = this.indices.map((index) => {
      if (!_.inRange(index, this.n)) {
        throw new Error(`Index ${index} is out of range`);
      }
      return this.secretsB[index];
    });

    this.client.send('challengeResponse', {
      secrets: selectedSecrets.map((secret) => secret.toString('hex'))
    });
    return this.await('challengeVerified', 'handleChallengeVerified');
  }

  handleChallengeVerified() {
    console.log("Hashes verified by peer");

    return transactionGenerator.makeBobCommitTx({
      privateKeyIn: this.prvkeyB0,
      changeAddress: this.changeAddress,
      amount: this.amount,
      lockTime: this.bobLockTime,
      hashesB: this.invIndices.map((i) => this.hashesB[i]),
      pubkeyA2: this.pubkeyA2,
      pubkeyB2: this.prvkeyB2.toPublicKey()
    })
      .then(({ transaction, redeemScript }) => {
        this.bobCommitRedeemScript = redeemScript;
        return blockchain.broadcast(transaction).then(() => transaction);
      })
      .then((transaction) => {
        this.client.send('bobCommitment', { tx: transaction.toString() });
        return this.awaitWithTimeout('aliceCommitment', 'handleAliceCommitment', this.bobLockTime)
          .catch((err) => {
            this.checkReclaimFunds();
            throw err;
          });
      });
  }

  handleAliceCommitment({ tx: serializedTx }) {
    const transaction = new bitcore.Transaction(serializedTx);
    console.log(`Received Alice's commitment ${transaction.hash}`);

    this.aliceCommitRedeemScript = transactionGenerator.makeAliceCommitScript({
      lockTime: this.aliceLockTime,
      hashesAB: this.invIndices.map((i) => this.hashesAB[i]),
      pubkeyA1: this.pubkeyA1,
      pubkeyB1: this.prvkeyB1.toPublicKey()
    });
    const aliceCommitOutScript = this.aliceCommitRedeemScript.toScriptHashOut();
    const hasOutput = _.any(transaction.outputs, (output) => {
      return output.script.toString() == aliceCommitOutScript.toString() &&
        output.satoshis == this.amount;
    });

    if (!hasOutput) {
      throw new Error("Transaction does not have expected output");
    }

    const aliceCommitAddress = aliceCommitOutScript.toAddress();
    return blockchain.whenAddressHasBalance(aliceCommitAddress, this.amount, this.bobLockTime)
      .then(this.checkReclaimFunds.bind(this))
      .then(() => {
        console.log("Alice's commitment transaction was confirmed.");

        return transactionGenerator.makeBobClaimTx({
          redeemScript: this.aliceCommitRedeemScript,
          privateKey: this.prvkeyB1,
          outAddress: this.outAddress,
          secretsAB: this.invIndices.map((i) => this.secretsAB[i])
        })
      })
      .then((transaction) => {
        console.log(`Broadcasting claim transaction ${transaction.hash}`);
        console.log(`DEBUG: ${transaction.toString()}`);
        return blockchain.broadcast(transaction).then(() => transaction);
      });
  }

  checkReclaimFunds() {
    if (fairExchange.currentTime() < this.bobLockTime) {
      return;
    }

    console.log("Locktime expired. Reclaiming funds.");
    return transactionGenerator.makeRefundTx({
      redeemScript: this.bobCommitRedeemScript,
      privateKey: this.prvkeyB2,
      lockTime: this.bobLockTime,
      outAddress: this.addressB0
    })
      .then((transaction) => {
        console.log(`Broadcasting refund transaction ${transaction.hash}`);
        console.log(`DEBUG: ${transaction.toString()}`);
        return blockchain.broadcast(transaction).then(() => transaction);
      })
      .then(() => {
        throw new Error(
          "Timed out waiting for Alice's commitment to confirm. Commitment reclaimed");
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }
}

module.exports = BobProtocol;
