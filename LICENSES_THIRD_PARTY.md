# Third-party software notices

Chess Review Lab bundles or includes production code from the packages below. This file is a practical distribution notice, not legal advice. The complete license texts are copied into `dist/licenses/`; Stockfish's GPL text is also at `dist/engine/COPYING.txt`.

| Software | Version | License | Use |
| --- | --- | --- | --- |
| Stockfish / stockfish.js | 18.0.8 (Stockfish 18 full NNUE single-thread build) | GNU GPL v3 | Local chess engine, JavaScript loader, and WebAssembly binary |
| chess.js | 1.4.0 | BSD 2-Clause | PGN parsing and legal move generation |
| idb | 8.0.3 | ISC | IndexedDB promise wrapper |
| lucide-react | 0.542.0 | ISC | UI icons |
| React | 19.1.1 | MIT | UI runtime |
| React DOM | 19.1.1 | MIT | DOM renderer |
| scheduler | 0.26.0 | MIT | React runtime dependency |

## Stockfish distribution obligations

Stockfish and the packaged stockfish.js distribution are provided under GPL-3.0. Distributing the extension with the engine requires preserving the copyright/license notices and satisfying the GPL's corresponding-source requirements for the exact binary being distributed. The installed package's full GPL text is included with the build. Corresponding upstream source and build instructions are available from:

- Stockfish: https://github.com/official-stockfish/Stockfish
- stockfish.js: https://github.com/nmrugg/stockfish.js

Anyone redistributing a modified engine build must make the complete corresponding source for that build available under GPL-3.0 and retain applicable notices. The small Node loader in the npm package carries an MIT header; the engine distribution itself remains GPL-3.0.

## Permissive dependencies

The BSD-2-Clause, ISC, and MIT license texts shipped in `dist/licenses/` must remain with redistributed copies where their terms require preservation of copyright and permission notices. Exact notices are copied from the installed, lockfile-pinned packages during `npm run build`.

| cburnett chess piece SVGs (via Lichess chessground assets) | n/a | GPL-3.0-or-later (Colin M.L. Burnett, tri-licensed GFDL/BSD/GPL) | `dist/pieces/*.svg` |
