'use strict';

const bitcore = require('bitcore-lib');
const _ = require('lodash');
const crypto = require('crypto');

function integerToBuffer(integer) {
  var buffer = new Buffer(4);
  buffer.writeUInt32LE(integer);
  return buffer;
}

function makeSolicitationTransaction() {
  const onionAddress = 'qsu33twdme5te4bx.onion';
  const nonce = crypto.randomBytes(16);
  const mixPool = 12;

  const privateKey = new bitcore.PrivateKey('884ac877404cfb4405c7ebd70702fdd4c89c6cf9a9f3eabbc6b355aa2fc4f7dd');

  let textScript = new bitcore.Script()
    .add(bitcore.Opcode.OP_RETURN)
    .add(bitcore.util.buffer.concat([
        nonce,
        new Buffer(onionAddress),
        integerToBuffer(mixPool)
      ])
    );

  const inputAmount = 6625000;
  const adFeeHalf = 35000;
  const utxo = {
    'txId' : 'f0351ce6993e18b556df38e759b6938c7e6300a3ceff8c265491a544d957f606',
    'outputIndex' : 1,
    'address' : 'mq5KCdQ2fcBwnQ27XD7F7QdecLdxtgEPGE',
    "script" : '76a91468d7e50872ef32041d97b2fac76e631419d24df988ac',
    "satoshis" : inputAmount
  };

  var transaction = new bitcore.Transaction()
    .from(utxo)
    .addOutput(new bitcore.Transaction.Output({
      script: textScript,
      satoshis: 10000 // may not need to burn...
    }));

  transaction.to(privateKey.toAddress(), inputAmount - transaction._estimateFee() - adFeeHalf)
    .sign(privateKey);

  return transaction;
}

/*
 * confirmed tx example:
 * https://live.blockcypher.com/btc-testnet/tx/cb65fa713df82f35d24964630f338f4c624e7b202d671c420049c8e952d91376/
 *
 * confirmed tx data in hex:
 irb(main):044:0> hex = 'dfffa3579a1be134614551eeac5e134171737533337477646d653574653462782e6f6e696f6e0c000000'
=> "dfffa3579a1be134614551eeac5e134171737533337477646d653574653462782e6f6e696f6e0c000000"
irb(main):045:0> nonce = hex[0..31]
=> "dfffa3579a1be134614551eeac5e1341"
irb(main):047:0> onion = hex[32..75]
=> "71737533337477646d653574653462782e6f6e696f6e"
irb(main):049:0> [onion].pack('H*').force_encoding('utf-8')
=> "qsu33twdme5te4bx.onion"
irb(main):050:0> pool = hex[76..-1]
=> "0c000000"
irb(main):053:0> [pool].pack('H*').unpack('L*')
=> [12]
*/

exports.makeSolicitation = makeSolicitationTransaction;
