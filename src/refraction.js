const _ = require('lodash');

const config = {};

function configure(configChanges) {
  _.merge(config, configChanges);
}

exports.configure = configure;
exports.config = config;
