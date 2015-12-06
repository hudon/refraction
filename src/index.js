const fs = require ('fs');
const program = require('commander');
const readline = require('readline');
const bitcore = require('bitcore-lib');

bitcore.Networks.defaultNetwork = bitcore.Networks.testnet;

const pkg = require('../package.json');
const refraction = require('./refraction');
const Session = require('./session');

// TODO(hudon) take in bitcoin network, tor, etc. config as args or from
// config file
program
  .version(pkg.version)
  // eventually (with full xim) we won't need this
  .option('-a, --alice', 'Start communication as Alice')
  .option('-c, --config <path>', 'Path to config')
  .option('-p, --private-key <hex>', 'Private key for input')
  .parse(process.argv);

const configPath = program.config || 'config.json';
refraction.configure(JSON.parse(fs.readFileSync(configPath)));
refraction.configure({ isAlice: program.alice });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function handleAddress(address) {
  const privateKey = program.privateKey && new bitcore.PrivateKey(program.privateKey);
  const session = new Session(address, privateKey);

  console.log('CLI: Generated deposit address: ', session.privateKeyIn.toAddress().toString());
  console.log('CLI: With private key: ', session.privateKeyIn.toString());
  console.log('CLI: We will mix the first deposit received to the above address.');

  session.start()
    .then(() => {
      console.log('CLI: Refraction done! Starting again...');
      runRefraction();
    })
    .catch((err) => {
      console.error(err);
      console.log(err.stack);
      return rl.close();
    });
}

function runRefraction() {
  rl.question("Please provide a payout address to send mixed bitcoin to (or nothing to quit): ", handleAddress);
}

runRefraction();
