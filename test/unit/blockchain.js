'use strict';

require('../support/config');

const bitcore = require('bitcore-lib');
const expect = require('chai').expect;
const nock = require('nock');

const blockchain = require('../../src/blockchain');

describe("blockchain", () => {
  describe("#balance", () => {
    const address = bitcore.Address.fromString('mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv');

    beforeEach(() => {
      nock("https://testnet.blockexplorer.com")
        .get("/api/addr/mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv")
        .reply(200, {
          addrStr: "mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv",
          balance: 0.0468,
          balanceSat: 4680000,
          unconfirmedBalance: 0.0032,
          unconfirmedBalanceSat: 320000
        });
    });

    it("returns the confirmed balance", (done) => {
      blockchain.balance(address)
        .then((balance) => {
          expect(balance).to.eq(4680000);
          done();
        })
        .catch(done);
    });

    it("returns total balance when includeUnconfirmed option is true", (done) => {
      blockchain.balance(address, { includeUnconfirmed: true })
        .then((balance) => {
          expect(balance).to.eq(5000000);
          done();
        })
        .catch(done);
    });
  });

  describe("#broadcast", () => {
    const tx = new bitcore.Transaction("01000000017ace134611317fc8ce0c4a71bd94b7b795b05c525f9847da26f5c7fc5ad4f25101000000da0047304402200347035958681a79d3c85b6dd1e0fc9426229201a696f9d9f75c09dd8b0d673302201ed464175219c62e10e07b05fb6e0329d06d767fb768c49276f8edc78cc576b701483045022100ab0494b78c4e6b9cdfd56c2e80a0d3f58ff7b2f62f4b66711156410ee3b7c43a02203233a2fa114c68451ddbe4d1d938bbf154973dfa475a0ae9a924dcf020bc883f0147522102632178d046673c9729d828cfee388e121f497707f810c131e0d3fc0fe0bd66d62103a0951ec7d3a9da9de171617026442fcd30f34d66100fab539853b43f508787d452aeffffffff0240420f000000000017a914b1689e12304b05b0f7ba64c2ac4bc3e142546f3c87407ecaee0000000017a9148ce5408cfeaddb7ccb2545ded41ef478109454848700000000");

    it("broadcasts the transaction", (done) => {
      const scope = nock("https://testnet.blockexplorer.com")
            .post("/api/tx/send")
            .reply(200, {});

      blockchain.broadcast(tx)
        .then((txHash) => {
          scope.done();
          expect(txHash).to.eq(tx.hash);
          done();
        })
        .catch(done);}
      );
  });

  describe("#whenAddressHasBalance", () => {
    const address = bitcore.Address.fromString('mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv');

    it("polls the address endpoint until the balance exceeds the amount given", (done) => {
      const scope = nock("https://testnet.blockexplorer.com")
              .get("/api/addr/mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv")
              .reply(200, { balanceSat: 100 });

      blockchain.whenAddressHasBalance(address, 100, { pollInterval: 0 })
        .then(() => {
          scope.done();
          done();
        })
        .catch(done);
    });
  });

  describe("#whenCoinsSentFromAddress", () => {
    const address = bitcore.Address.fromString('mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv');

    it("polls until there is a transaction spending from the given address", (done) => {
      const tx1 = {
        txid: '905b30b0feeba199210715a21fb0801b70f0f6f2832dcc140da856e3c0c21d88',
        vin: [{ addr: 'mpLbTm4dpEDQV72RuU5UpyWeuXQFYu7eRi', n: 0 }]
      };
      const tx2 = {
        txid: '2a56a49240615b238ab9fbdd01924d262c5d1488571daa74fdaff94efc26c4d4',
        vin: [{ addr: 'mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv', n: 0 }]
      };
      const addressScope = nock("https://testnet.blockexplorer.com")
              .get("/api/addr/mqoc8UP712FmqkMtXsa8SEkNyZg2BGjySv")
              .reply(200, { transactions: [tx1.txid, tx2.txid] });
      const tx1Scope = nock("https://testnet.blockexplorer.com")
              .get(`/api/tx/${tx1.txid}`)
              .reply(200, tx1);
      const tx2Scope = nock("https://testnet.blockexplorer.com")
              .get(`/api/tx/${tx2.txid}`)
              .reply(200, tx2);

      blockchain.whenCoinsSentFromAddress(address, 100, { pollInterval: 0 })
        .then(({ txHash, index }) => {
          expect(txHash).to.eq('2a56a49240615b238ab9fbdd01924d262c5d1488571daa74fdaff94efc26c4d4');
          expect(index).to.eq(0);

          addressScope.done();
          tx1Scope.done();
          tx2Scope.done();
          done();
        })
        .catch(done);
    });
  });
});
