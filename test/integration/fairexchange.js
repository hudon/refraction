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

  it('Alice and Bob can communicate', function(done) {
    sinon.spy(client, 'send');
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
    const spendingInput = {
      txHash: "b647c7679331368abe90c6b172ea5da110df26db06ebb6eb3fd48c31bcc58cb6",
      index: 0
    };
    const inputScript = new bitcore.Script("20bd44c38c61f61b3e5aefcaa03b1eb7063d05ea254d0cd0929e6c3a6ab6101df820c7b28b1c6da6b708ed5a05e97d5236a4763f1aec65b3c4cb0775798dc70fad2920e0dfec02e9b545dd2256ea8357e18cc5ad2f4ac50393929bd8a0350db1ad8c4f483045022100dd756970ab34d829ec3610ca33d0b59643a75c3493b76e3bd1be099811e911910220740dafd8ce5b85b4eb064e777e81f097c1b21c4d0e6f97f63f0ee4711e35d17901004cb96304d18e6156b175210258d8ab11d9f367ecdf9f0ff3bff0e8b673f219f8aefa735bde80e1ff5e59b26eac672102348042b9b4ca0e438c27452ea7b6a60ddc7c7a1788af07b3ece70e95d7095b7aadaa207f1defeb6853da7a5a21157fddece8cb37eb026db8c96d7dbb3e0780b6c233dc88aa20842d55b70d781f7bee8faa77e011865119f10d62ba00448d630473a9089aa0f288aa20502e698a138f5e52704a90b904fed0b0194e776154cc9d0f3bd925affe7b71cb8768");
    utxosStub.returns(Promise.resolve([commitUTXO]));
    utxosStub.withArgs(bobPrivateKey.toAddress()).returns(Promise.resolve([bobInputUTXO]));
    utxosStub.withArgs(alicePrivateKey.toAddress()).returns(Promise.resolve([aliceInputUTXO]));
    sinon.stub(blockchain, 'broadcastTransaction').returns(Promise.resolve());
    sinon.stub(blockchain, 'whenAddressHasBalance').returns(Promise.resolve());
    sinon.stub(blockchain, 'whenCoinsSentFromAddress').returns(Promise.resolve([spendingInput]));
    sinon.stub(blockchain, 'fetchInputScript').returns(Promise.resolve(inputScript));

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
      outAddress: bobAddressOut
    });

    Promise.all([bob.start(), alice.start()])
      .then(() => {
        expect(client.send).to.not.have.been.calledWith('error');

        expect(client.send).to.have.been.calledWith('hello');
        expect(client.send).to.have.been.calledWith('params');
        expect(client.send).to.have.been.calledWith('secrets');
        expect(client.send).to.have.been.calledWith('hashes');
        // expect(client.send).to.have.been.calledWith('bobCommitment');

        done();
      })
      .catch((err) => {
        console.error(err);
        done(err);
      });
  });
});
