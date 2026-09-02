# Chess Review Lab — Microsoft Edge Manual Acceptance

Release candidate under test: ____________________  
Tester: ____________________  
Date: ____________________  
Edge version: ____________________

Use only completed historical games or imported PGNs for engine analysis. Never request engine analysis while playing a live rated or competitive game.

## Installation

1. From `D:\chess_analys`, run `npm ci` and `npm run verify:release`.
2. Open `edge://extensions` in Microsoft Edge desktop.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the absolute directory `D:\chess_analys\dist`.
6. Confirm Chess Review Lab appears with its knight/analysis icon and no manifest error.
7. Pin Chess Review Lab to the toolbar.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test A — Popup

1. Open the toolbar popup on a non-Chess.com page.
2. Confirm the popup renders without blank content or visible error.
3. Confirm **Import PGN**, **Previous reviews**, and **Settings** are present and clickable.
4. Inspect the popup console from `edge://extensions` if anything fails.

Expected:

- Popup renders with no console/runtime error.
- Import PGN exists.
- Settings exists.
- Previous Reviews exists.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test B — Standard PGN and navigation

Use `tests/fixtures/clean-game.pgn`:

```pgn
[Event "Clean"]
[White "Alpha"]
[Black "Beta"]
[WhiteElo "1600"]
[BlackElo "1550"]
[Result "1-0"]

1. e4 {Controls the center.} e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6
5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 1-0
```

1. Select **Import PGN**.
2. Paste the fixture and start analysis.
3. Confirm the review page opens and all 17 plies render.
4. Click move-list entries and confirm the board position follows.
5. Press **Home**, **End**, **Left Arrow**, and **Right Arrow**.

Expected:

- Import succeeds and the review opens.
- All moves render.
- Board navigation and move selection are correct.
- Home/End and Left/Right keys select the correct ply.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test C — Engine and incremental analysis

1. Set analysis quality to **Balanced**.
2. Analyze the standard PGN.
3. Observe progress and partial review updates.
4. Select several completed moves while reviewing results.

Expected:

- Stockfish initializes with no missing-WASM error.
- Position progress increases.
- Results appear incrementally.
- Best move and a non-empty PV appear for analyzed moves.
- Eval bar and graph update with move selection.
- The UI remains responsive.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test D — Cancellation and restart

1. Set analysis quality to **Deep**.
2. Start a multi-move analysis.
3. Select **Cancel analysis** while progress is active.
4. Confirm progress stops and the UI remains usable.
5. Start analysis again immediately.

Expected:

- Cancellation stops the active analysis.
- No continuing progress or late stale result overwrites the later run.
- The second run initializes and completes normally.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test E — Classification fixtures

Import each repository fixture:

- `tests/fixtures/clean-game.pgn`
- `tests/fixtures/queen-blunder.pgn`
- `tests/fixtures/missed-mate.pgn`
- `tests/fixtures/tactical-sacrifice.pgn`
- `tests/fixtures/ordinary-exchange.pgn`
- `tests/fixtures/promotion.pgn`
- `tests/fixtures/draw.pgn`
- `tests/fixtures/black-blunder.pgn`

Expected:

- Every valid fixture imports without a crash.
- Classifications and explanations are plausible evidence-based approximations.
- The ordinary exchange is not marked Brilliant.
- Promotion renders correctly.
- Black-side evaluation and Expected Points use the Black mover’s perspective.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test F — Cache and Previous Reviews

1. Enable review caching in Settings.
2. Analyze one fixture completely.
3. Open **Previous reviews**.
4. Reopen the completed review.
5. Confirm it opens without a new analysis progress sequence.
6. Delete the cached review and refresh the list.

Expected:

- The completed review appears in Previous Reviews.
- Reopening a compatible cache entry does not rerun Stockfish.
- Deletion removes the entry.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test G — Live-game protection

Do not use engine assistance to play a real rated or competitive game. This check is popup/state detection only.

1. If a safe non-playing active-game page is available, open it without selecting any analysis action.
2. Open the Chess Review Lab popup.
3. Do not attempt an engine or internal bypass on the active game.

Expected:

- The popup displays **Analysis disabled** for `LIVE_GAME`.
- No Analyze completed game button, evaluation, best move, PV, classification, hint, or arrow is exposed.
- Manual PGN import remains available for later use after completion.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test H — Unknown state

1. Open a Chess.com page that is not positively recognized as a completed game, without playing or requesting analysis.
2. Open the extension popup.

Expected:

- The popup reports that game status cannot be confirmed.
- Online-game analysis cannot be initiated.
- Manual PGN fallback remains available.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test I — Completed Chess.com game

1. Open a genuinely completed historical Chess.com game.
2. Open the popup.
3. If the game is recognized and its PGN is available in public page content, select **Analyze completed game**.
4. If extraction is unavailable, confirm the explicit paste-PGN fallback message and use the historical game’s PGN manually.

Expected:

- A supported completed page is positively detected.
- Automatic extraction succeeds where current markup is recognized.
- Otherwise, a clear manual-PGN fallback is shown.
- A known supported completed page is not incorrectly reported as live.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Test J — Runtime consoles and resources

1. Open `edge://extensions` and inspect the Chess Review Lab service-worker console.
2. Inspect the popup and review-page consoles.
3. Review Network/Console output during one completed analysis.

Expected:

- No uncaught exceptions.
- No Content Security Policy violations.
- No missing WASM or worker error.
- No failed manifest resource reference.
- No remote executable JavaScript request.

Result: **NOT RUN**  
Evidence: ________________________________________________

## Acceptance summary

Installation: **NOT RUN**  
Popup: **NOT RUN**  
Standard PGN/navigation: **NOT RUN**  
Engine/incremental results: **NOT RUN**  
Cancellation/restart: **NOT RUN**  
Classification fixtures: **NOT RUN**  
Cache: **NOT RUN**  
Live-game protection: **NOT RUN**  
Unknown state: **NOT RUN**  
Completed Chess.com game: **NOT RUN**  
Runtime consoles: **NOT RUN**

Overall manual acceptance: **NOT RUN**
