'use strict';

const bitcore = require('bitcore-lib');
const _ = require('lodash');

const blockchain = require('../blockchain');

function makeAdTransaction(ad) {
  let textScript = new bitcore.Script()
    .add(bitcore.Opcode.OP_RETURN)
    .add(bitcore.util.buffer.concat([
        ad.nonce,
        new Buffer(ad.serverURL),
        integerToBuffer(ad.mixPool)
      ])
    );

  return blockchain.utxos(ad.privateKey.toAddress()).then((utxos) => {
    return new bitcore.Transaction()
      .from(utxos)
      .addOutput(new bitcore.Transaction.Output({
        script: textScript,
        satoshis: 0 // may need to burn dust?
      }))
      .to(privateKey.toAddress(), ad.amount - transaction._estimateFee() - ad.fee / 2)
      .sign(privateKey);
  });
}

exports.makeAdTransaction = makeAdTransaction;
