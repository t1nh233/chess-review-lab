# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chess Review Lab: a Microsoft Edge Manifest V3 extension for local post-game chess review (Chess.com completed games, pasted PGN, uploaded `.pgn`). Analysis runs entirely in-browser with a locally packaged Stockfish 18 lite single-thread WASM. No backend, accounts, or telemetry. TypeScript + React 19 + Vite; tests with Vitest. UI strings in the popup are Vietnamese.

## Commands (PowerShell)

```powershell
npm ci
npm run typecheck
npm run lint
npm run test                 # all vitest
npx vitest run tests/unit/safety.test.ts          # single file
npx vitest run -t "name pattern"                  # single test by name
npm run test:unit | test:integration | test:safety
npm run build                # vite build + content-script IIFE build -> dist/ (the unpacked extension)
npm run test:stockfish       # smoke-tests the engine files in dist/ (build first)
npm run validate:dist        # validate dist after every production build
npm run package:store        # zip dist/ -> release/chess-review-lab-<version>.zip for Edge Add-ons (fails if >50 MB)
npm run verify:release       # full fail-fast gate: typecheck, lint, tests, build, stockfish, validate
npm run benchmark:analysis   # env: BENCHMARK_PGN, BENCHMARK_DEPTH, BENCHMARK_STRATEGY=legacy|optimized|selective
```

Load `dist/` via `edge://extensions` → Developer mode → Load unpacked. `npm run dev` is only for isolated UI work; never use it to review live games. Manual acceptance checklist: `docs/MANUAL_EDGE_ACCEPTANCE.md`.

Note: git may report "dubious ownership" for this directory; that requires `git config --global --add safe.directory D:/chess_analys` (user's call).

## Architecture

The domain layer (`src/chess`, `src/engine`, `src/analysis`, `src/safety`) is independent of React. UI lives in `src/popup`, `src/review`, `src/components`, `src/presentation`.

Durable analysis flow: `popup -> service worker coordinator (src/background) -> offscreen document (src/offscreen) -> module Worker -> Stockfish Worker`. The offscreen host owns the engine client, so closing the popup does not cancel analysis; the popup reconnects to a compact session summary, and the full review is persisted by analysis ID (IndexedDB, `src/storage`) and opened in `review.html` on demand. Visiting Chess.com alone never starts the engine. Entry points: `popup.html`, `review.html`, `offscreen.html`, `manifest.json`, built by `vite.config.ts` (the content script is built separately by `vite.content.config.ts` as one self-contained IIFE, because content scripts are classic scripts and cannot use static `import`; `validate:dist` fails if it does) (which also copies the Stockfish JS/WASM and license files into `dist/`).

Analysis pipeline (`src/analysis/analyzeGame.ts`): build canonical position table -> base MultiPV1 pass at depth 12–14 for all positions -> `refinementPolicy.ts` (config in `refinementConfig.json`) selectively refines only boundary/unstable/critical/mate-changing/special candidates -> selective MultiPV3 evidence. Versioned position cache (`positionAnalysisCache.ts`) lets deeper entries satisfy shallower requests. `AbortSignal` cancels queued work and sends UCI `stop`. Engine searches are serialized in `StockfishClient.analyze` (a new request waits for an aborted one to finish). Theme (dark default) is applied through `src/theme/themeMode.ts` and `data-theme` CSS tokens. Review presets: Fast depth 16, Compatibility 20, Deep 22.

Conventions that span files:
- Engine scores are always White-relative; convert to mover-relative Expected Points (`expectedPoints.ts`) before classification (Black = `1 - EP_white`).
- Classification thresholds (EP loss: Excellent ≤0.02, Good ≤0.05, Inaccuracy ≤0.10, Mistake ≤0.20, Blunder >0.20) are centralized; Great/Brilliant/missed_opportunity are separate heuristics (`greatMove.ts`, `brilliant.ts`, `missedOpportunity.ts`) with secondary tags. These are independent approximations, not Chess.com's algorithms.
- Display labels follow Chess.com Game Review: ten Vietnamese categories (`src/presentation/displayClassification.ts`; precedence in `src/popup/displayClassification.ts`: Book, Brilliant, Great, Blunder, Miss, Mistake, Inaccuracy, Best/Excellent/Good). The summary table defaults to the brief rows (Great, Best, Excellent, Mistake, Miss, Blunder, plus Brilliant when non-zero) and expands to all ten. Book plies come from the ECOUrl slug (`src/chess/openingBook.ts`).
- Versions/cache keys live in `src/config/versions.ts`; bump them when changing analysis output so cached reviews invalidate.
- PGN export (`src/chess/pgnExport.ts`): clean PGN preserves the source; analysis PGN adds round-trip-safe `[%crl_*]` comments. Imported CRL comments are historical only; re-analysis always runs the engine.

## UI skin (hand-painted "Ghibli summer" look)

Design source of truth: the Claude Design canvas "Chess Review Lab" (tokens, mascot "Tốt", ten move symbols). Shared skin is `src/ghibli.css` (tokens, buttons, cards, popup); review-page-only overrides live in `src/ghibli-review.css` and must be imported after `chesscom.css` (Vite hoists shared CSS ahead of entry-only CSS, so review rules in the shared file lose to `chesscom.css`). Fonts are bundled locally (Nunito body, Patrick Hand headings; OFL licenses copied to `dist/licenses/`). All copy is in `src/i18n/vi.ts`. The mascot is `src/components/Mascot.tsx` (moods happy/think/sleepy/sad/cheer/mini); the ten move symbols are drawn in `src/presentation/classificationIcons.tsx` (each category has a distinct silhouette, so colour is never the only cue). Extension icons in `public/icons` and the store logo in `docs/store/assets` are renders of the mascot. Keep text contrast at WCAG AA (never put text on the grass/light-blue classification colours).

## Game list and completion detection

`src/adapters/chessCom/latestGame.ts` lists a player's finished games from the public archive (one month per page). The popup and the review page's "Ván đấu" view share `src/popup/LatestGameCard.tsx`; the saved username lives in `src/storage/chessComProfile.ts`; `src/background/latestGameWatcher.ts` polls once a minute via `chrome.alarms` and sets a "NEW" badge. Page-based completion detection is unreliable, so `serviceWorker.ts` also accepts a game as finished when its id is found in the archive (`archiveVerifiedSnapshot`).

## Fair-play safety (fail-closed, do not weaken)

`src/safety/liveGameGuard.ts` defines exactly four states: `SAFE_COMPLETED_GAME`, `SAFE_IMPORTED_PGN`, `LIVE_GAME`, `UNKNOWN`; only the two SAFE states are authorized, and `UNKNOWN` fails closed. The guard is enforced independently in the popup, Chess.com adapter (`src/adapters/chessCom`, `src/content`), service worker, pipeline, engine client, and engine worker. Chess.com completion requires a final result plus positive completion evidence; any live indicator wins; a FEN or URL alone is insufficient. Extraction uses only public page content (no private endpoints). The content script is declared statically only for game paths (`/game/*`, `/play/*`, `/live*`, `/analysis/*`, `/games/*`; guarded by `tests/unit/manifestScope.test.ts` and `validate:dist`) and is injected on demand by the popup (`inspectTab`, activeTab + `scripting`) elsewhere on chess.com; if injection fails the state stays UNKNOWN. Any change touching these paths must keep `npm run test:safety` passing.

## Licensing

The project is GPL-3.0 (`LICENSE`) because it distributes Stockfish; the repo must stay public for store distribution. Store listing text and permission justifications: `docs/store/LISTING.md`; privacy policy: `docs/PRIVACY_POLICY.md`. Stockfish is GPL-3.0; keep `dist/engine/COPYING.txt` and `dist/licenses/` in builds (see `LICENSES_THIRD_PARTY.md`).
