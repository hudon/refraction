const AdvertiserProtocol = require('./advertiser-protocol');
const RespondentProtocol = require('./respondent-protocol');

function start() {
  let protocolClass;
  if (Math.random() < 0.5) {
    protocolClass = AdvertiserProtocol;
  } else {
    protocolClass = RespondentProtocol;
  }
  const protocol = new protocolClass();
  protocol.start();
}

exports.start = start;
