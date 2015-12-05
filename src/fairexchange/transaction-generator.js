'use strict';

const bitcore = require('bitcore-lib');
const _ = require('lodash');

const blockchain = require('../blockchain');

function integerToBuffer(integer) {
  var buffer = new Buffer(4);
  buffer.writeUInt32LE(integer);
  return buffer;
}

function makeBobCommitScript({ lockTime, hashesB, pubkeyA2, pubkeyB2 }) {
  let script = new bitcore.Script()
      .add(bitcore.Opcode.OP_IF)
      .add(integerToBuffer(lockTime))
      .add(bitcore.Opcode.OP_CHECKLOCKTIMEVERIFY)
      .add(bitcore.Opcode.OP_DROP)
      .add(pubkeyB2.toBuffer())
      .add(bitcore.Opcode.OP_CHECKSIG)
      .add(bitcore.Opcode.OP_ELSE)
      .add(pubkeyA2.toBuffer())
      .add(bitcore.Opcode.OP_CHECKSIGVERIFY)
      .add(bitcore.Opcode.OP_HASH256);
  for (let i = 0; i < hashesB.length; i++) {
    if (i < hashesB.length - 1) {
      script = script.add(bitcore.Opcode.OP_DUP);
    }
    script = script.add(hashesB[i]).add(bitcore.Opcode.OP_EQUAL);
    if (i < hashesB.length - 1) {
      script = script.add(bitcore.Opcode.OP_SWAP);
    }
  }
  for (let i = 0; i < hashesB.length - 1; i++) {
    script = script.add(bitcore.Opcode.OP_BOOLOR)
  }
  script = script.add(bitcore.Opcode.OP_ENDIF);
  return script;
}

function makeBobCommitTx(
  { privateKeyIn, changeAddress, amount, lockTime, hashesB, pubkeyA2, pubkeyB2 }
) {
  return blockchain.utxos(privateKeyIn.toAddress()).then((utxos) => {
    const redeemScript = makeBobCommitScript(
      { lockTime, pubkeyB2, pubkeyA2, hashesB });
    return makeCommitTx({
      redeemScript: redeemScript,
      utxos: utxos,
      amount: amount,
      changeAddress: changeAddress,
      privateKeyIn: privateKeyIn
    });
  });
}

function makeBobClaimTx({ redeemScript, outAddress, secretsAB, privateKey }) {
  return makeClaimTx({
    redeemScript,
    outAddress,
    privateKey,
    scriptData: secretsAB.reverse()
  });
}

function makeAliceCommitScript({ lockTime, hashesAB, pubkeyA1, pubkeyB1 }) {
  let script = new bitcore.Script()
      .add(bitcore.Opcode.OP_IF)
      .add(integerToBuffer(lockTime))
      .add(bitcore.Opcode.OP_CHECKLOCKTIMEVERIFY)
      .add(bitcore.Opcode.OP_DROP)
      .add(pubkeyA1.toBuffer())
      .add(bitcore.Opcode.OP_CHECKSIG)
      .add(bitcore.Opcode.OP_ELSE)
      .add(pubkeyB1.toBuffer())
      .add(bitcore.Opcode.OP_CHECKSIGVERIFY)
  for (let i = 0; i < hashesAB.length; i += 1) {
    let hashAB = hashesAB[i];
    script = script
      .add(bitcore.Opcode.OP_HASH256)
      .add(hashAB)
    if (i < hashesAB.length - 1) {
      script = script.add(bitcore.Opcode.OP_EQUALVERIFY)
    } else {
      script = script.add(bitcore.Opcode.OP_EQUAL)
    }
  }
  script = script.add(bitcore.Opcode.OP_ENDIF);
  return script;
}

function makeRefundTx({ redeemScript, privateKey, outAddress, lockTime }) {
  const inAddress = redeemScript.toScriptHashOut().toAddress();
  console.log(inAddress.toString());
  return blockchain.utxos(inAddress).then((utxos) => {
    console.log(utxos);
    let inputAmount = _.sum(utxos.map((utxo) => utxo.satoshis));
    let transaction = bitcore.Transaction().from(utxos);
    transaction = transaction
      .to(outAddress, inputAmount - transaction._estimateFee())
      .lockUntilDate(lockTime);
    console.log(transaction);

    for (let i = 0; i < transaction.inputs.length; i++) {
      const signature = bitcore.Transaction.Sighash.sign(
        transaction,
        privateKey,
        bitcore.crypto.Signature.SIGHASH_ALL,
        i,
        redeemScript
      );

      let scriptSig = (new bitcore.Script())
          .add(
            bitcore.util.buffer.concat([
              signature.toDER(),
              bitcore.util.buffer.integerAsSingleByteBuffer(bitcore.crypto.Signature.SIGHASH_ALL)
            ])
          )
          .add(bitcore.Opcode.OP_TRUE)
          .add(redeemScript.toBuffer());
      transaction.inputs[i].setScript(scriptSig);
    }
    return transaction;
  });
}

function makeAliceCommitTx(
  { privateKeyIn, changeAddress, amount, lockTime, hashesAB, pubkeyA1, pubkeyB1 }
) {
  return blockchain.utxos(privateKeyIn.toAddress()).then((utxos) => {
    let redeemScript = makeAliceCommitScript({ lockTime: lockTime, hashesAB, pubkeyA1, pubkeyB1 });
    return makeCommitTx({
      redeemScript: redeemScript,
      utxos: utxos,
      amount: amount,
      changeAddress: changeAddress,
      privateKeyIn: privateKeyIn
    });
  });
}

function makeAliceClaimTx({ redeemScript, outAddress, secretB, privateKey }) {
  return makeClaimTx({ redeemScript, outAddress, privateKey, scriptData: [secretB]});
}

function makeClaimTx({ redeemScript, outAddress, scriptData, privateKey }) {
  const inAddress = redeemScript.toScriptHashOut().toAddress();
  return blockchain.utxos(inAddress).then((utxos) => {
    let inputAmount = _.sum(utxos.map((utxo) => utxo.satoshis));
    let transaction = bitcore.Transaction().from(utxos);
    transaction = transaction.to(outAddress, inputAmount - transaction._estimateFee());

    for (let i = 0; i < transaction.inputs.length; i++) {
      const signature = bitcore.Transaction.Sighash.sign(
        transaction,
        privateKey,
        bitcore.crypto.Signature.SIGHASH_ALL,
        i,
        redeemScript
      );

      let scriptSig = new bitcore.Script();
      for (let buffer of scriptData) {
        scriptSig = scriptSig.add(buffer);
      }
      scriptSig = scriptSig
        .add(
          bitcore.util.buffer.concat([
            signature.toDER(),
            bitcore.util.buffer.integerAsSingleByteBuffer(bitcore.crypto.Signature.SIGHASH_ALL)
          ])
        )
        .add(bitcore.Opcode.OP_FALSE)
        .add(redeemScript.toBuffer());
      transaction.inputs[i].setScript(scriptSig);
    }
    return transaction;
  });
}

function makeCommitTx({ redeemScript, utxos, amount, changeAddress, privateKeyIn }) {
  const transaction = (new bitcore.Transaction())
        .from(utxos)
        .addOutput(new bitcore.Transaction.Output({
          satoshis: amount,
          script: redeemScript.toScriptHashOut()
        }))
        .change(changeAddress)
        .sign([privateKeyIn]);
  return { transaction, redeemScript };
}

exports.makeBobCommitTx = makeBobCommitTx;
exports.makeBobCommitScript = makeBobCommitScript;
exports.makeBobClaimTx = makeBobClaimTx;
exports.makeAliceCommitTx = makeAliceCommitTx;
exports.makeAliceCommitScript = makeAliceCommitScript;
exports.makeAliceClaimTx = makeAliceClaimTx;
exports.makeRefundTx = makeRefundTx;
