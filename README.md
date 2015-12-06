# Refraction
## Decentralized Bitcoin Mixing Service

Refraction is an implementation of the FairExchange protocol defined in Barber et al. [0]. FairExchange is a way for two parties to exchange bitcoin in a way that obfuscates who exchanged with whom. It is possible to know that a fair exchange happened, however, because of the format of the custom redeem script in the claim transactions.

The goal is to fully implement the Xim protocol explained in [1]. With Xim, it is possible to mix bitcoin in a decentralized way without being vulnerable to Sybil attacks.


## Current state

This project should be considered a toy reference implementation -- it is not even close to stable. *You are strongly encouraged to only use this on testnet with coins you are willing to lose*. Private keys generated during the exchange are not backed up anywhere currently.

This project currently assumes you have an onion address of the person you are trading with. The script currently only does one round of fair exchange.

The commitment transactions generated send to P2SH outputs. Unlike the original paper, the commitment scripts use OP_CHECKLOCKTIMEVERIFY instead of having the peers trade partially signed refund transactions.


## Getting started

1. Create a config file. The default location for the configuration is `config.json` in the root of the project. You can copy the configuration from `examples/config.json` by running `$ cp examples/config.json config.json`.

2. Run a Tor Socks5 proxy locally. If you run the [Tor browser bundle](https://www.torproject.org/), that will be configured automatically.

3. If you are running the server, you must configure a [Tor hidden service](https://www.torproject.org/docs/tor-hidden-service.html.en) that the client can connect to. If you use the example configuration, the HiddenServicePort line should be `HiddenServicePort 80 127.0.0.1:8080`.

4. If you are running the client, you will need to set the `aliceClient.destination` configuration path to the onion address of the server you are communicating with.

5. Install dependencies: `$ npm install`.

6. If you are running the server, run `npm run server`. If you are running the client, run `npm run client`.

7. You will be prompted to enter a payout address. You should enter a newly generated address.

8. A new deposit address will be generated and printed to the console. Fund the address with a small amount (> 0.001) of coins. On testnet, you can send coins directly from a [faucet](http://tpfaucet.appspot.com/) if you don't have any testnet coins yet.

9. The rest should happen automatically.

## TODO

- fix the block explorer querying and broadcasting (blockchain.js)
- remove the hacks, streamline the CLI
- Implement Xim
- Move to using BitcoinJ and SPV rather than using some centralized API like
  BlockCypher or BlockExplorer
- Integrate with wallet(s)


## Authors

- [Antonio Juliano](https://github/AntonioJuliano)
- [James Hudon](https://github.com/hudon)
- [Jim Posen](https://github.com/jimpo)


## License

Refraction is released under the terms of the MIT license. See [COPYING](COPYING) for more
information or see http://opensource.org/licenses/MIT.


## References

[0] http://elaineshi.com/docs/bitcoin.pdf

[1] http://forensics.umass.edu/pubs/bissias.wpes.2014.pdf
