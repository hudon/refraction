'use strict';

require('../../support/config');

const expect = require('chai').expect;

const fairExchange = require('../../../src/fairexchange');

describe('fairExchange', function() {
  describe('#currentTime()', function() {
    it('returns a timestamp', function() {
      expect(fairExchange.currentTime()).to.be.a('number');
    });
  });

  describe('#generateSecrets()', function() {
    it('returns an array of random buffers', function(done) {
      fairExchange.generateSecrets(5)
        .then((result) => {
          expect(result.length).to.eq(5);
          for (let buffer of result) {
            expect(buffer.length).to.eq(32);
          }
          done();
        })
        .catch(done);
    });
  });
});
