const _ = require('lodash');

const refraction = require('../../src/refraction');

refraction.configure({
  insightUrl: "https://testnet.blockexplorer.com",
  tor: {
    ip: "127.0.0.1",
    port: 9150
  }
});
