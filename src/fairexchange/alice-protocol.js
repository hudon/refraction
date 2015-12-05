'use strict';

const bitcore = require('bitcore-lib');
const bufferMath = require('math-buffer');
const _ = require('lodash');

const blockchain = require('../blockchain');
const fairExchange = require('./index');
const transactionGenerator = require('./transaction-generator');
const BaseProtocol = require('./base-protocol');

class AliceProtocol extends BaseProtocol {
  constructor({ client, amount, privateKeyIn, outAddress }) {
    super();
    this.client = client;
    this.amount = amount;
    this.prvkeyA0 = privateKeyIn;
    this.addressA0 = this.prvkeyA0.toAddress();
    this.changeAddress = this.addressA0;
    this.outAddress = outAddress;
  }

  start() {
    this.client.send('hello', {
      address: this.addressA0.toString(),
      amount: this.amount
    });
    return this.await('params', 'handleParams');
  }

  handleParams({ aliceLockTime, bobLockTime, address, n, m }) {
    console.log("Received exchange parameters from peer");

    if (blockchain.balance(address) < this.amount) {
      throw new Error("Address has insufficient balance");
    }

    // TODO: Validate locktimes, n, and m

    this.aliceLockTime = aliceLockTime;
    this.bobLockTime = bobLockTime;
    this.n = n;
    this.m = m;
    this.prvkeyA1 = new bitcore.PrivateKey();
    this.prvkeyA2 = new bitcore.PrivateKey();

    return fairExchange.generateSecrets(this.n).then((secretsA) => {
      this.secretsA = secretsA;

      this.client.send('secrets', {
        pubkeyA1: this.prvkeyA1.toPublicKey().toString(),
        pubkeyA2: this.prvkeyA2.toPublicKey().toString(),
        secretsA: this.secretsA.map((secret) => secret.toString('hex'))
      });
      return this.await('hashes', 'handleHashes');
    });
  }

  handleHashes({ hashesAB, hashesB, pubkeyB1, pubkeyB2 }) {
    console.log("Received hashes of secrets from peer");

    this.hashesB = hashesB.map((secret) => new Buffer(secret, 'hex'));
    this.hashesAB = hashesAB.map((secret) => new Buffer(secret, 'hex'));
    this.pubkeyB1 = new bitcore.PublicKey(pubkeyB1);
    this.pubkeyB2 = new bitcore.PublicKey(pubkeyB2);

    if (this.hashesB.length !== this.n) {
      throw new Error(`Did not receive ${this.n} hashes of B secrets`);
    }
    if (this.hashesAB.length !== this.n) {
      throw new Error(`Did not receive ${this.n} hashes of secret sums`);
    }
    // TODO: Check size/entropy of hashes

    this.indices = fairExchange.pickIndices(this.n, this.m);
    this.invIndices = _.difference(_.range(this.n), this.indices);

    this.client.send('challenge', {
      indices: this.indices
    });
    return this.await('challengeResponse', 'handleChallengeResponse');
  }

  handleChallengeResponse({ secrets }) {
    console.log(`Received challenge response from peer`);

    for (let i = 0; i < this.m; i++) {
      const index = this.indices[i];
      const secretB = new Buffer(secrets[i], 'hex');
      const sum = new Buffer(32);
      bufferMath.add(this.secretsA[index], secretB, sum);
      if (!fairExchange.hash(secretB).equals(this.hashesB[index]) ||
          !fairExchange.hash(sum).equals(this.hashesAB[index])) {
        throw new Error(`Detected hash mismatch`);
      }
    }

    this.client.send('challengeVerified', {});
    return this.await('bobCommitment', 'handleBobCommitment');
  }

  handleBobCommitment({ tx: serializedTx }) {
    const transaction = new bitcore.Transaction(serializedTx);
    console.log(`Received Bob's commitment ${transaction.hash}`);

    this.bobCommitRedeemScript = transactionGenerator.makeBobCommitScript({
      lockTime: this.bobLockTime,
      hashesB: this.invIndices.map((i) => this.hashesB[i]),
      pubkeyA2: this.prvkeyA2.toPublicKey(),
      pubkeyB2: this.pubkeyB2
    });
    const bobCommitOutScript = this.bobCommitRedeemScript.toScriptHashOut();
    const hasOutput = _.any(transaction.outputs, (output) => {
      return output.script.toString() == bobCommitOutScript.toString() &&
        output.satoshis == this.amount;
    });

    if (!hasOutput) {
      throw new Error("Transaction does not have expected output");
    }

    const bobCommitAddress = bobCommitOutScript.toAddress();
    return blockchain.whenAddressHasBalance(bobCommitAddress, this.amount)
      .then(() => {
        console.log("Bob's commitment transaction was confirmed.");

        return transactionGenerator.makeAliceCommitTx({
          privateKeyIn: this.prvkeyA0,
          amount: this.amount,
          changeAddress: this.changeAddress,
          lockTime: this.aliceLockTime,
          hashesAB: this.invIndices.map((i) => this.hashesAB[i]),
          pubkeyA1: this.prvkeyA1.toPublicKey(),
          pubkeyB1: this.pubkeyB1
        });
      })
      .then(({ transaction, redeemScript }) => {
        this.aliceCommitRedeemScript = redeemScript;
        return blockchain.broadcastTransaction(transaction).then(() => transaction);
      })
      .then((transaction) => {
        this.client.send('aliceCommitment', { tx: transaction.toString() });
        return this.awaitClaimTransaction();
      });
  }

  awaitClaimTransaction() {
    const inputAddress = this.aliceCommitRedeemScript.toScriptHashOut().toAddress();
    console.log(`Waiting for coins to be sent from ${inputAddress}`);

    return blockchain.whenCoinsSentFromAddress(inputAddress)
      .then((inputs) => {
        console.log(`Transaction ${inputs[0].txHash} spends from address ${inputAddress}`);
        return blockchain.fetchInputScript(inputs[0].txHash, inputs[0].index);
      })
      .then((scriptSig) => {
        const chunks = _.take(scriptSig.chunks, this.invIndices.length);
        chunks.reverse();

        const validSecretsB = [];
        for (let i = 0; i < this.invIndices.length; i++) {
          const index = this.invIndices[i];

          const secretAB = chunks[i].buf;
          const secretA = this.secretsA[index];
          const secretB = new Buffer(32);
          bufferMath.subtract(secretAB, secretA, secretB);
          if (fairExchange.hash(secretB).equals(this.hashesB[index])) {
            validSecretsB.push(secretB);
          }
        }

        if (validSecretsB.length === 0) {
          throw new Error("Could not reconstruct any of Bob's secrets from scriptSig");
        }
        console.log(`Reconstructed ${validSecretsB.length} secrets from Bob`);

        return transactionGenerator.makeAliceClaimTx({
          redeemScript: this.bobCommitRedeemScript,
          privateKey: this.prvkeyA2,
          outAddress: this.outAddress,
          secretB: validSecretsB[0]
        });
      })
      .then((transaction) => {
        console.log(`Broadcasting claim transaction ${transaction.hash}`);
        console.log(`DEBUG: ${transaction.toString()}`);
        return blockchain.broadcastTransaction(transaction).then(() => transaction);
      });
  }
}

module.exports = AliceProtocol;
