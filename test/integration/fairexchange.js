'use strict';

require('../support/config');

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
chai.use(require('sinon-chai'));

const bitcore = require('bitcore-lib');
const EventEmitter = require('events').EventEmitter;

const blockchain = require('../../src/blockchain');
const fairExchange = require('../../src/fairexchange');
const AliceProtocol = require('../../src/fairexchange/alice-protocol');
const BobProtocol = require('../../src/fairexchange/bob-protocol');

const MockClient = require('../support/mock-client');

describe('Fair Exchange', function() {
  const client = new MockClient();

  const amount = 100000000;
  const alicePrivateKey = new bitcore.PrivateKey();
  const bobPrivateKey = new bitcore.PrivateKey();
  const aliceAddressOut = (new bitcore.PrivateKey()).toAddress();
  const bobAddressOut = (new bitcore.PrivateKey()).toAddress();

  beforeEach(() => {
    const utxosStub = sinon.stub(blockchain, 'utxos');
    const aliceInputUTXO = new bitcore.Transaction.UnspentOutput({
      txId: "b647c7679331368abe90c6b172ea5da110df26db06ebb6eb3fd48c31bcc58cb6",
      outputIndex: 1,
      address: alicePrivateKey.toAddress(),
      script: bitcore.Script.buildPublicKeyHashOut(alicePrivateKey.toAddress()),
      satoshis: amount * 2
    });
    const bobInputUTXO = new bitcore.Transaction.UnspentOutput({
      txId: "b647c7679331368abe90c6b172ea5da110df26db06ebb6eb3fd48c31bcc58cb6",
      outputIndex: 0,
      address: bobPrivateKey.toAddress(),
      script: bitcore.Script.buildPublicKeyHashOut(bobPrivateKey.toAddress()),
      satoshis: amount * 2
    });
    const commitUTXO = new bitcore.Transaction.UnspentOutput({
      txId: "b647c7679331368abe90c6b172ea5da110df26db06ebb6eb3fd48c31bcc58cb6",
      outputIndex: 3,
      script: bitcore.Script.buildPublicKeyHashOut((new bitcore.PrivateKey()).toAddress()),
      satoshis: amount
    });
    const spendingTx = new bitcore.Transaction("010000000155ca5babe50aca88a894a58ab2aa8b99e7639a33844208a5086d4e12716ea15800000000fd68012099cfc06b51ebb798c81c906f05b1091fa223ca8049ad16e7c6ee91d39aaffe392095caa9c379ffad25a612c26b11b3616dd7088737ee2847513f0b11e826415e8820b51f3da6dc586d9440db9e203d1ea0028f07b48f19f497b4ded7db099acc3f29483045022100a207097c35315f6d8cb80c8a95c75c98843e4a5d3383af7f67f35f05d789964602204a6475d568b18786f635163ed851b8abdc1d32b7ceba3a3d12a62d6fcb26972301004cb963048b206256b17521029800d3b76acf66631693dea61f4a8f9c2bd65b492c7f545edbcf80eb9d9ed319ac67210308f817c4759cefe3008bb43da7daa8410726a33dcd5d606e0a6dbeff8facee8dadaa20f8fc44219abf246808c4dd88f62fd822bae904b1837afd590521acd81a93a12e88aa203eda3c7849e4607a610bc2b77e6a40fc72f271c6d695010b619c95c0374e51a788aa2038680b85e9510a2caef790adec8e207959b5bf8a1a423d2b416bb71e0239db3c8768ffffffff01905f0100000000001976a91470d77f02a1964d85bb6c7fd1501b3b6cf869104588ac00000000");
    const spendingInput = {
      txHash: spendingTx.hash,
      index: 0
    };

    sinon.spy(client, 'send');
    utxosStub.returns(Promise.resolve([commitUTXO]));
    utxosStub.withArgs(bobPrivateKey.toAddress()).returns(Promise.resolve([bobInputUTXO]));
    utxosStub.withArgs(alicePrivateKey.toAddress()).returns(Promise.resolve([aliceInputUTXO]));
    sinon.stub(blockchain, 'broadcast').returns(Promise.resolve());
    sinon.stub(blockchain, 'whenAddressHasBalance').returns(Promise.resolve());
    sinon.stub(blockchain, 'whenCoinsSentFromAddress').returns(Promise.resolve(spendingInput));
    sinon.stub(blockchain, 'transaction')
      .withArgs(spendingTx.hash)
      .returns(Promise.resolve(spendingTx));
  });

  afterEach(() => {
    blockchain.broadcast.restore();
    blockchain.whenAddressHasBalance.restore();
    blockchain.whenCoinsSentFromAddress.restore();
    blockchain.utxos.restore();
    blockchain.transaction.restore();
  });

  it('Alice and Bob can communicate', function(done) {
    const alice = new AliceProtocol({
      client: client,
      amount: amount,
      privateKeyIn: alicePrivateKey,
      outAddress: aliceAddressOut
    });
    const bob = new BobProtocol({
      client: client,
      amount: amount,
      privateKeyIn: bobPrivateKey,
      outAddress: bobAddressOut,
      n: 10,
      m: 7
    });

    Promise.all([bob.start(), alice.start()])
      .then(() => {
        expect(client.send).to.not.have.been.calledWith('error');

        expect(client.send).to.have.been.calledWith('hello');
        expect(client.send).to.have.been.calledWith('params');
        expect(client.send).to.have.been.calledWith('secrets');
        expect(client.send).to.have.been.calledWith('hashes');
        expect(client.send).to.have.been.calledWith('bobCommitment');

        done();
      })
      .catch((err) => {
        console.error(err);
        done(err);
      });
  });
});
