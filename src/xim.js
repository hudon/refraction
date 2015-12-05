const refraction = require('./refraction')
const PeerClient = require('./peer-client')

function discover() {
  const options = {};
  options.isAlice = refraction.config.isAlice;
  options.tor = refraction.config.tor;
  if (options.isAlice) {
    options.destination = refraction.config.aliceClient.destination;
  } else {
    options.server = refraction.config.bobClient.server;
  }
  const client = new PeerClient(options);
  return client.init().then(() => client);
}
exports.discover = discover;
