'use strict';
var _ = require('underscore');
var bitcore = require('bitcore');
var fairExchange = require('./app/scripts/fair-exchange');

//bitcore.Transaction.FEE_PER_KB = 1000;
bitcore.Networks.defaultNetwork = bitcore.Networks.testnet;

var privateKeyBob0 = "47f06b475de4e507a95e6205457dcf548f3fee6692af531de23ed031dc14b688";
privateKeyBob0 = new bitcore.PrivateKey(privateKeyBob0);
var publicKeyBob0 = privateKeyBob0.toPublicKey();
var addressBob0 = privateKeyBob0.toAddress();

var privateKeyBob2 = "552821763ed1a84c0616c0631c049e8a766ff7c84dc4e3bad0533c07d171cf46"
privateKeyBob2 = new bitcore.PrivateKey(privateKeyBob2);
var publicKeyBob2 = privateKeyBob2.toPublicKey();
var addressBob2 = privateKeyBob2.toAddress();

var privateKeyAlice2 = "66a5e3233e9629545a425df485b0c04ca1dcbc3ec708c8cce87c8961e43446de"
privateKeyAlice2 = new bitcore.PrivateKey(privateKeyAlice2);
var publicKeyAlice2 = privateKeyAlice2.toPublicKey();
var addressAlice2 = privateKeyAlice2.toAddress();

const privateKeyAliceOut = new bitcore.PrivateKey('d180d14e97c5566e97393fa95f68efd057ef3c410559462b2a51e942e9507410');
const privateKeyBobOut = new bitcore.PrivateKey('d180d14e97c5566e97393fa95f68efd057ef3c410559462b2a51e942e9507410');

const now = 1449126935;


var intToBuffer = function (integer) {
  var buffer = new Buffer(4);
  buffer.writeUInt32LE(integer);
  return buffer;
};

function makeBobRedeemTx(previousTxHash, prevTxIndex) {
  const redeemScript = makeScript();
  const outputScript = redeemScript.toScriptHashOut();
  const utxo = new bitcore.Transaction.UnspentOutput({
    txid: previousTxHash,
    outputIndex: 0,
    script: outputScript,
    satoshis: 1000000
  });
  const transaction = bitcore.Transaction()
        .from([utxo])
        .lockUntilDate(now)
        .addOutput(new bitcore.Transaction.Output({
          satoshis: 998000,
          script: bitcore.Script.buildPublicKeyHashOut(privateKeyBobOut.toAddress())
        }));

  const signature = bitcore.Transaction.Sighash.sign(
    transaction,
    privateKeyBob2,
    bitcore.crypto.Signature.SIGHASH_ALL,
    0,
    redeemScript
  );
  const scriptSig = new bitcore.Script()
        .add(
          bitcore.util.buffer.concat([
            signature.toDER(),
            bitcore.util.buffer.integerAsSingleByteBuffer(bitcore.crypto.Signature.SIGHASH_ALL)
          ])
        )
        .add(bitcore.Opcode.OP_TRUE)
        .add(redeemScript.toBuffer());
  transaction.inputs[0].setScript(scriptSig);
  return transaction;
}

function makeAliceClaimTx(previousTxHash, prevTxIndex) {
  const redeemScript = makeScript();
  const outputScript = redeemScript.toScriptHashOut();
  const utxo = new bitcore.Transaction.UnspentOutput({
    txid: previousTxHash,
    outputIndex: prevTxIndex,
    script: outputScript,
    satoshis: 90000
  });
  const transaction = bitcore.Transaction()
        .from([utxo])
        .addOutput(new bitcore.Transaction.Output({
          satoshis: 80000,
          script: bitcore.Script.buildPublicKeyHashOut(addressBob0)
        }));

  const signature = bitcore.Transaction.Sighash.sign(
    transaction,
    privateKeyAlice2,
    bitcore.crypto.Signature.SIGHASH_ALL,
    0,
    redeemScript
  );
  const scriptSig = new bitcore.Script()
        .add(intToBuffer(3))
        .add(
          bitcore.util.buffer.concat([
            signature.toDER(),
            bitcore.util.buffer.integerAsSingleByteBuffer(bitcore.crypto.Signature.SIGHASH_ALL)
          ])
        )
        .add(bitcore.Opcode.OP_FALSE)
        .add(redeemScript.toBuffer());
  transaction.inputs[0].setScript(scriptSig);
  return transaction;
}

function makeBobCommTx(previousTxHash, previousTxIndex) {
  let utxos = [new bitcore.Transaction.UnspentOutput({
    txid: previousTxHash,
    outputIndex: previousTxIndex,
    address: addressBob0,
    script: bitcore.Script.buildPublicKeyHashOut(addressBob0),
    satoshis: 100000
  })];

  let transaction = bitcore.Transaction().from(utxos);
  let redeemScript = makeScript();
  transaction = transaction
    .addOutput(new bitcore.Transaction.Output({
      satoshis: 90000,
      script: redeemScript.toScriptHashOut()
    }))
    .change(addressBob0)
    .sign([privateKeyBob0]);
  return transaction;
};

var makeAd1 = function () {
  let advertiserDepositKey = new bitcore.PrivateKey("884ac877404cfb4405c7ebd70702fdd4c89c6cf9a9f3eabbc6b355aa2fc4f7dd");
  let advertiserDepositAddr = advertiserDepositKey.toAddress();
  let previousTxHash = '46bc963658b38d5e249db473a690ce423ed1a9da26d5ac9e2bfa040276069b24';
  let utxos = [new bitcore.Transaction.UnspentOutput({
    txid: previousTxHash,
    outputIndex: 0,
    address: advertiserDepositAddr,
    script: bitcore.Script.buildPublicKeyHashOut(advertiserDepositAddr),
    satoshis: 7000000
  })];
  let transaction = bitcore.Transaction().from(utxos);
  let redeemScript = 
};

var makeAd1Script = function () {

};

var makeRespondent = function () {
};

var makeAd2 = function () {
};

function makeScript() {
  var secretsB = [1, 2, 3, 4, 100, 200, 84733, 4888, 90001, 11];
  var secretsA = [10, 892, 103, 44, 110, 290, 3330, 9, 123890, 121];
  var secretsBBuffers = secretsB.map(intToBuffer);
  var secretsABuffers = secretsA.map(intToBuffer);

  var hashesAB = _.zip(secretsA, secretsB).map(
    ([secretA, secretB]) => fairExchange.hash(secretA + secretB)
  );
  var hashesB = secretsB.map(fairExchange.hash);

  var indices = [1, 3, 0, 9, 8];
  var invIndices = [2, 4, 5, 6, 7];
  var nowBuf = intToBuffer(now)

  let script = new bitcore.Script()
      .add(bitcore.Opcode.OP_IF)
      .add(nowBuf)
      .add(bitcore.Opcode.OP_CHECKLOCKTIMEVERIFY)
      .add(bitcore.Opcode.OP_DROP)
      .add(publicKeyBob2.toBuffer())
      .add(bitcore.Opcode.OP_CHECKSIG)

      .add(bitcore.Opcode.OP_ELSE)
      .add(publicKeyAlice2.toBuffer())
      .add(bitcore.Opcode.OP_CHECKSIGVERIFY)
      .add(bitcore.Opcode.OP_HASH256);

   invIndices.forEach((i, idx, arr) => {
     if (idx < arr.length - 1) {
       script = script.add(bitcore.Opcode.OP_DUP);
     }
     script = script
       .add(new Buffer(hashesB[i], 'hex'))
       .add(bitcore.Opcode.OP_EQUAL);
     if (idx < arr.length - 1) {
       script = script.add(bitcore.Opcode.OP_SWAP);
     }
   });

  for(var i = 0; i < invIndices.length - 1; i += 1) {
    script = script.add(bitcore.Opcode.OP_BOOLOR)
  }

  script = script.add(bitcore.Opcode.OP_ENDIF);

  return script;
}

exports.makeScript = makeScript;
exports.makeBobCommTx = makeBobCommTx;
exports.makeAliceClaimTx = makeAliceClaimTx;
exports.makeBobRedeemTx = makeBobRedeemTx;
