# Chess Review Lab

Chess Review Lab is an original Microsoft Edge Manifest V3 extension for local, post-game chess review. It accepts finished Chess.com games (picked from your public game list or the current page), pasted PGN, and uploaded `.pgn` files. Analysis runs in the browser with the locally packaged Stockfish 18 lite WebAssembly engine; there is no backend, account, telemetry, analytics, or cloud engine. The only network calls are reads of Chess.com's public archive (`api.chess.com/pub`).

## Features

- Local Stockfish 18 evaluation, best move, MultiPV continuation, and mate scores
- Legal PGN parsing with headers, comments, castling, promotion, en passant, check, and mate
- Board navigation, last-move highlight, optional best-move arrow, and White/Black orientation
- Interactive keyboard-operable evaluation graph and classification badges
- Chess.com-style Game Review categories (Brilliant, Great, Book, Best, Excellent, Good, Inaccuracy, Mistake, Miss, Blunder) with a brief and a detailed summary view
- transparent Great, Brilliant, Book (from the PGN's `ECOUrl`), and missed-opportunity heuristics
- game list from your Chess.com username: pick any finished game, switch games from the review page, and a toolbar badge when a new game ends
- two-column move list with piece figurines and time spent per move (from PGN clock comments)
- dark (default), light, and system themes
- mover-relative Expected Points and deterministic Estimated Accuracy
- two-stage progressive results, real UCI depth streaming, selection-prioritized refinement, cancellation, and worker failure recovery
- IndexedDB review cache with versioned keys, retention, previous-review list, and deletion
- Fast Review (depth 16), Compatibility Review (depth 20), and Deep Review (depth 22) presets
- searches are queued, so stepping quickly through moves never reports "already analyzing"
- clean and annotated PGN copy/download with round-trip-safe CRL comments
- fail-closed live-game guard enforced in the popup, Chess.com adapter, service worker, pipeline, engine client, and worker

## Architecture

The domain layer is independent of React:

- `src/chess/`: PGN parsing, position construction, and material accounting
- `src/engine/`: typed engine contract, UCI parser, client, and nested Web Worker
- `src/analysis/`: pipeline, Expected Points, classification, special-move heuristics, criticality, explanations, and accuracy
- `src/safety/`: shared fail-closed safety state and authorization guard
- `src/adapters/chessCom/`: isolated public-page completion evidence and PGN extraction
- `src/background/`: validated, short-lived review authorization messages
- `src/storage/`: IndexedDB review cache and extension settings
- `src/components/`, `src/review/`, `src/popup/`: original review and popup interfaces
- `tests/unit/`, `tests/integration/`, `tests/fixtures/`: deterministic tests and golden PGNs

The toolbar popup is the primary lightweight review client. Durable work follows `popup -> service worker coordinator -> offscreen document -> Stockfish Web Worker`, so closing the popup does not cancel or restart an authorized analysis. The popup reconnects to a compact session summary; the full review is persisted by analysis ID and opened only when **Xem phân tích sâu** is requested.

The popup shows the accuracy summary only; the move list, per-move commentary, evaluation graph, and game switching live on the review page. Labels follow Chess.com's Game Review in Vietnamese. The summary table defaults to the brief rows (Great, Best, Excellent, Mistake, Miss, Blunder, plus Brilliant when present) and expands to all ten categories. Presentation precedence is Book, Brilliant, Great, Blunder, Miss, Mistake, Inaccuracy, then Best/Excellent/Good.

The offscreen host owns the engine client for popup-started analysis. The client creates a module worker, which creates the locally packaged Stockfish worker. Expensive search never executes on the UI thread. Visiting Chess.com alone never starts the engine.

## Development

Requirements: a supported Node.js release and npm.

```powershell
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run dev` exists for isolated UI work, but is not required for builds or tests. Do not use a development server to review live online games.

## Testing

```powershell
npm run test:unit
npm run test:integration
npm run test:safety
npm run build
npm run test:stockfish
npm run validate:dist
npm run verify:release
npm run benchmark:analysis
```

The Stockfish smoke test loads the exact JS/WASM files from `dist/`, performs UCI and readiness handshakes, analyzes the starting position, verifies a forced capture, and verifies a mate score. It intentionally avoids brittle exact centipawn expectations.

`npm run verify:release` is the fail-fast, non-interactive release gate. Complete the human checklist at `docs/MANUAL_EDGE_ACCEPTANCE.md` before calling a build a manually accepted release candidate.

Measured architecture results and the independent Chess.com-label diagnostic are recorded in [`docs/PERFORMANCE_BENCHMARK.md`](docs/PERFORMANCE_BENCHMARK.md).

## Build

Run `npm run build`. Vite creates `dist/`, copies Manifest V3 metadata and icons, and packages the pinned Stockfish 18 single-threaded JavaScript/WASM pair locally. It also copies the GPL and permissive dependency license texts. Run `npm run validate:dist` after every production build.

## Load unpacked in Microsoft Edge

1. Run `npm ci` and `npm run build`.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this repository's `dist` directory.
6. Pin **Chess Review Lab**, then use the popup on a completed Chess.com game or choose **Import PGN**.

Edge should show no manifest errors. Keep the `dist/engine`, `dist/licenses`, and `dist/engine/COPYING.txt` files with redistributed builds.

## Analysis pipeline

The pipeline builds one canonical position table from the initial position through the terminal position. A base MultiPV1 pass analyzes every searchable position at depth 12–14. A pure selective policy then refines only classification-boundary, unstable, critical, mate-changing, or special-move candidates to the preset's intermediate or maximum depth. Stable positions far from a classification boundary finalize at base depth. Terminal positions remain represented without asking Stockfish for a nonexistent legal move. Required MultiPV3 evidence is selective, one-legal-move positions skip alternatives, and optional continuation expansion remains lazy. A versioned position cache distinguishes base and expanded results and permits a deeper compatible entry to satisfy a shallower request. Scores remain White-relative before mover-relative Expected Points conversion. An `AbortSignal` cancels queued work and sends UCI `stop` to active work.

`npm run benchmark:analysis` reports cold- and warm-cache metrics, per-phase time, depth selection, MultiPV counts, nodes, NPS, and queue wait on a fixed fixture. Set `BENCHMARK_PGN`, `BENCHMARK_DEPTH`, and `BENCHMARK_STRATEGY=legacy|optimized|selective` to reproduce architecture comparisons. Chess.com uses server-side compute, so this local single-thread engine does not promise identical wall-clock speed.

## PGN export

Clean PGN preserves the immutable imported source. Analysis PGN preserves the mainline and headers while adding Chess Review Lab metadata, conservative NAGs, and human-readable `[%eval]`, `[%depth]`, `[%crl_class]`, `[%crl_accuracy]`, Expected Points, best-move, and PV annotations. Export is entirely local and never starts engine analysis. Imported CRL comments are historical metadata only; re-analysis still runs the engine.

## Expected Points

`expectedPoints()` is a bounded, monotonic logistic approximation: 0 means expected loss, 0.5 is roughly equal, and 1 means expected win. Mate maps near the appropriate endpoint. The configurable curve uses the mover's own rating (`WhiteElo` for White and `BlackElo` for Black); a rating-aware practical floor keeps low-rating, strongly decided positions from collapsing to exact certainty. Internal evaluations are always White-relative; Black mover values are `1 - EP_white`.

This is an independent local approximation. It is not Chess.com's private Expected Points mapping.

## Move classification

Classification uses mover-relative Expected Points loss with centralized public compatibility boundaries:

- Excellent: at most 0.02
- Good: at most 0.05
- Inaccuracy: at most 0.10
- Mistake: at most 0.20
- Blunder: greater than 0.20

Best requires the engine's first move. With the optional compatibility setting enabled, an analyzed alternative ranked by MultiPV and within 20 centipawns may also be Best; disabling it reserves Best for the exact PV1 move. Floating-point EP rounding alone never creates a Best label.

## Great heuristic

A Great candidate must be best or near-best, substantially better in Expected Points than alternatives, consequential to the outcome, and not a trivial forced sequence. MultiPV supplies the uniqueness evidence. The detector returns a match, confidence, and serializable reasons.

## Brilliant heuristic

A Brilliant candidate must remain engine-approved while making a meaningful material investment that persists through several PV plies, retaining tactical compensation. Routine recaptures and moves from already overwhelmingly won positions are excluded. Immediate material delta alone is insufficient.

## Miss

`missed_opportunity` is a secondary tag. It is applied when the opponent first gives up a material amount of Expected Points and the response gives a material portion back. The response retains its ordinary primary quality classification.

## Estimated Accuracy

Move accuracy is a deterministic exponential function of Expected Points loss, bounded to 0–100, with explicit additional severity when a move newly allows mate. Position criticality determines its base weight; trivial forced moves and harmless play in already-decided positions are discounted. Game accuracy aggregates weighted error with a configurable power mean so one decisive mistake is not hidden by many routine moves. The UI deliberately calls this **Estimated Accuracy**.

Expected Points, Estimated Accuracy, classification compatibility, Great, Brilliant, and Miss are transparent independent approximations. They do not reproduce Chess.com's private algorithms, CAPS2, labels, or accuracy values.

## Fair Play safeguards

The shared safety type has exactly four states: `SAFE_COMPLETED_GAME`, `SAFE_IMPORTED_PGN`, `LIVE_GAME`, and `UNKNOWN`. Only the two safe states are authorized; `UNKNOWN` fails closed.

For Chess.com, a final result plus positive completion evidence is required. A FEN or URL alone is not sufficient, and any live indicator wins over completion signals. Unsafe states cannot obtain PGN through the adapter, create a service-worker review authorization, enter the analysis pipeline, initialize the engine client, or issue commands in the engine worker. The popup never exposes evaluation, PV, hints, arrows, or classifications for live or unknown pages. Automated safety tests exercise direct/internal bypass attempts.

Automatic extraction uses only legitimately available public page content and is best-effort. It does not call private endpoints or bypass access controls. Paste/upload import remains the reliable fallback.

## Known limitations

- Chess.com markup can change; page scraping is best-effort. Completion is also verified through the public archive, which lists finished games only, and manual PGN import is always available.
- The conservative completion detector may classify an unfamiliar completed page as `UNKNOWN` rather than risk live assistance.
- The packaged Stockfish 18 build is the lite single-threaded WASM (~7 MB, no SharedArrayBuffer needed). It keeps the extension small and quick to install and load, at the cost of slightly lower playing strength than the full 113 MB build; the Fast, Compatibility, and Deep presets compensate with search depth (Hash 64 MB).
- No cloud synchronization is provided; cached reviews stay in the current Edge profile and are retained up to the configured local limit.
- Browser/Edge unpacked-extension acceptance must be performed on a desktop environment that permits loading extensions; automated tests do not replace that manual check.

## Credits

Piece artwork: cburnett set from the Lichess chessground assets (GPL-3.0-or-later).

## Licenses

See [LICENSES_THIRD_PARTY.md](LICENSES_THIRD_PARTY.md). Stockfish/stockfish.js is GPL-3.0 and carries corresponding-source and notice obligations when redistributed. chess.js is BSD-2-Clause; idb and lucide-react are ISC; React, React DOM, and scheduler are MIT. Production builds contain the exact installed license texts under `dist/licenses/` and the Stockfish GPL text under `dist/engine/`.
