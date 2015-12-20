'use strict';

require('../support/config');

const expect = require('chai').expect;

const utils = require('../../src/utils');

describe('utils', function() {
  describe('#currentTime()', function() {
    it('returns a timestamp', function() {
      expect(utils.currentTime()).to.be.a('number');
    });
  });
});
