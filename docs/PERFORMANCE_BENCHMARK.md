# Performance and compatibility benchmark

Measured on the same machine with Stockfish 18 Lite Single Thread, depth 12, and `tests/fixtures/chesscom-low-rating-001.pgn` (118 plies, 119 canonical positions). The terminal checkmate position is represented but does not require a search.

| Metric | Legacy unconditional MultiPV3 | Progressive/selective |
| --- | ---: | ---: |
| Cold duration | 14,290.2 ms | 7,781.5 ms |
| Engine searches | 118 | 278 |
| MultiPV1 searches | 0 | 236 |
| MultiPV3 searches | 118 | 42 |
| Median search | 42.0 ms | 7.2 ms |
| P95 search | 313.8 ms | 113.5 ms |
| Total nodes | 9,486,089 | 5,782,286 |
| Worker initialization count | 1 | 1 |
| Duplicate same-configuration FEN searches | 0 | 0 |
| Warm-cache duration | 18.1 ms | 22.1 ms |

The optimized cold run was 1.84× faster, a 45.55% duration reduction. It performs more inexpensive MultiPV1 searches because it deliberately supplies an early pass and a final pass, but reduces node count and avoids MultiPV3 on 76 of 118 searchable positions. Results vary by CPU; run `npm run benchmark:analysis` locally for current hardware.

The separate depth-20 compatibility diagnostic used mover-specific ratings (`WhiteElo`/`BlackElo`) and matched 12 of the 24 supplied Chess.com reference labels exactly (50%). This is not a release gate and is not claimed as proprietary-model equivalence. The public Expected Points loss boundaries were not changed to fit the fixture. Notably, `28...Bxa1` was not considered Great by Stockfish Lite at this depth/configuration, so it remains an investigated compatibility limitation rather than a position-specific exception.

Chess.com's Game Review runs on server-side infrastructure and may use substantially more compute. Chess Review Lab instead optimizes for local execution, progressive feedback, worker reuse, safe caching, and selective alternative analysis.
