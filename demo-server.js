var http = require('http');
var fs = require('fs');
var Socks = require('Socks');

// https://www.torproject.org/docs/tor-hidden-service.html.en
// add to /Applications/TorBrowser.app/TorBrowser/Data/Tor/torrc:
// HiddenServiceDir /tmp/hs
// HiddenServicePort 80 127.0.0.1:8080
// HiddenServiceDir /tmp/hs2
// HiddenServicePort 80 127.0.0.1:8081
//
// the hidden service directories should have permissions 0700
// restart Tor
//
const torrcPath = '/Applications/TorBrowser.app/TorBrowser/Data/Tor/torrc'
const hiddenServicePath = '/tmp/hs'
const hiddenServicePath2 = '/tmp/hs2'

var socksAgent = new Socks.Agent({
    proxy: {
        ipaddress: "127.0.0.1",
        port: 9150,
        type: 5,
    }},
    false, // we are connecting to a HTTPS server, false for HTTP server
    false // rejectUnauthorized option passed to tls.connect(). Only when secure is set to true
);

var receives = []
function handleRequest(request, response) {
  receives.push(request.url)
  fs.readFile(hiddenServicePath2 + '/hostname', 'utf8', function (err, data) {
    if (err) return console.log(err);
    var host = data.trim();
    var req = http.request({ hostname: host, path: '/server-1-hit-you', agent: socksAgent }, function () {
      response.end('Received request! Urls hit so far: ' + receives);
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });
    req.end();

  });
}

const port = 8080;
var server = http.createServer(handleRequest);

server.listen(port, function(){
    console.log("Server listening on: http://localhost:%s", port);
});

const port2 = 8081
const server2 = http.createServer(handleRequest2);
var receives2 = [];
function handleRequest2(request, response) {
  receives2.push(request.url);
  response.end('Received request (server 2)! Urls hit so far: ' + receives2);
}
server2.listen(port2, function(){
    console.log("Server listening on: http://localhost:%s", port2);
});
