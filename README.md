# Refraction
## Decentralized Bitcoin Mixing Service

Refraction is a toy implementation of the FairExchange protocol defined in
Barber et al. [0]. FairExchange is a way for two parties to exchange bitcoin
in a way that obfuscates who exchanged with who. It is possible to know that a
fair exchange happened, however, because of the use of custom scripts.

The goal is to fully implement the Xim protocol explained in [1]. With Xim, it
is possible to mix bitcoin in a decentralized way without being vulnerable to
Sybil attacks.

## Current state

This project currently assumes you know who you are exchanging with and just
does 1 round at a time.

The commitment transactions generated use P2SH outputs and use CLTV rather than a
raw nLockTime transaction.


## TODO

- fix the block explorer querying and broadcasting (blockchain.js)
- remove the hacks, streamline the CLI
- Implement Xim
- Move to using BitcoinJ and SPV rather than using some centralized API like
  BlockCypher or BlockExplorer
- Integrate with wallet(s)


## Authors

- [Antonio Juliano](github/AntonioJuliano)
- [James Hudon](github.com/hudon)
- [Jim Posen](github.com/jimpo)


## License

Refraction is released under the terms of the MIT license. See [COPYING](COPYING) for more
information or see http://opensource.org/licenses/MIT.


## References

[0] http://elaineshi.com/docs/bitcoin.pdf

[1] http://forensics.umass.edu/pubs/bissias.wpes.2014.pdf

