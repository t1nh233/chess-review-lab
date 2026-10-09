# Chess Review Lab — Microsoft Edge Manual Acceptance

Release candidate under test: ____________________  
Tester: ____________________  
Date: ____________________  
Edge version: ____________________

Use only completed historical games or imported PGNs for engine analysis. Never request engine analysis while playing a live rated or competitive game.

## Required release acceptance checklist

Use this checklist as the release decision record. Detailed procedures and evidence fields follow below. Do not mark an item PASS without observing it in Microsoft Edge desktop.

### Installation

- [ ] Open `edge://extensions`.
- [ ] Enable **Developer mode**.
- [ ] Select **Load unpacked** and choose the absolute `D:\chess_analys\dist` directory.
- [ ] Confirm the extension loads with no manifest errors.

### Popup

- [ ] Completed-game analysis starts.
- [ ] Analysis progress is visible.
- [ ] Current real Stockfish depth is visible.
- [ ] The popup may be closed during analysis.
- [ ] Reopen the popup while analysis is running.
- [ ] Analysis continues from current progress instead of restarting.
- [ ] Final White Estimated Accuracy is shown.
- [ ] Final Black Estimated Accuracy is shown.
- [ ] All six Vietnamese classifications are shown: **Thiên tài**, **Tuyệt**, **Tốt nhất**, **Sai lầm**, **Bỏ lỡ**, and **Nước sai lầm ngớ ngẩn**.

### Move list

- [ ] White and Black moves with the same full-move number share one popup row.
- [ ] Deep Review also uses one full-move row with separate White and Black cells.
- [ ] The long fixture's final row is exactly `59 | Kg1 | Qg2#`.

### Performance

- [ ] The first useful review appears quickly.
- [ ] There is no dramatic stall hidden behind misleading or fake linear progress.
- [ ] The refinement phase is clearly identified.
- [ ] The UI remains responsive during analysis.
- [ ] Late positions do not produce false search timeouts while real UCI progress continues.

### Deep Analysis

- [ ] **Xem phân tích sâu** opens the dedicated Review page.
- [ ] The same `analysisId` is reused.
- [ ] Opening Deep Review does not rerun the full game.
- [ ] Board display and ply navigation work.
- [ ] Evaluation graph selection works.
- [ ] Best move and principal variation display correctly.
- [ ] Lazy continuation lines load for the selected position.

### Summary UI

- [ ] All six classification icons and semantic colors render correctly.
- [ ] White and Black Estimated Accuracy values are correct for the completed review.
- [ ] All six classification-count rows contain correct White and Black counts.

### PGN export

- [ ] Clean PGN copies to the clipboard.
- [ ] Clean PGN downloads locally.
- [ ] Analysis PGN copies to the clipboard.
- [ ] Analysis PGN downloads locally.
- [ ] Exported Analysis PGN re-imports successfully with the same mainline and result.
- [ ] The final move `59...Qg2#` remains present after export and re-import.

### Cache

- [ ] A completed review can be reopened from Previous Reviews.
- [ ] Reopening a compatible cached review does not unnecessarily rerun full analysis.

### Safety

- [ ] `LIVE_GAME` is blocked.
- [ ] `UNKNOWN` is blocked.
- [ ] No evaluation, best move, PV, classification, hint, or engine suggestion is visible on a live game.
- [ ] Positively completed games and imported PGNs are allowed.

### Chess.com just-finished game

- [ ] Start a normal game without using engine assistance.
- [ ] During the game, the popup says **Ván đấu đang diễn ra** and exposes no engine analysis action or data.
- [ ] Finish the game by a normal supported result.
- [ ] Without refreshing Chess.com, open the popup.
- [ ] The popup identifies **Ván đấu vừa kết thúc**.
- [ ] **Phân tích ván vừa chơi** appears.
- [ ] Selecting it starts exactly one analysis.
- [ ] Close and reopen the popup; analysis continues rather than restarting.
- [ ] The completed summary appears.
- [ ] **Phân tích ván mới** returns to the current-game state and detects a newer completed game.
- [ ] No live evaluation, best move, PV, hint, or classification was available before completion.

### Console and resources

- [ ] No uncaught exceptions appear in popup, Review page, offscreen document, or service-worker consoles.
- [ ] No Stockfish WASM loading errors appear.
- [ ] No Content Security Policy errors appear.
- [ ] No missing manifest, icon, worker, script, stylesheet, or export resource errors appear.

Checklist result: **NOT RUN**
Evidence folder or notes: ________________________________________________

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

## Test K — Progressive performance

1. Import `tests/fixtures/chesscom-low-rating-001.pgn` and start Compatibility Review.
2. Confirm useful provisional moves and graph data appear during the fast pass.
3. Confirm displayed depth comes from changing Stockfish UCI output and reaches depth 20.
4. During refinement, select a distant move and confirm that area is prioritized after the active search.
5. Confirm the UI remains responsive and analysis does not restart from position 1.
6. Confirm the popup reports **Quick analysis**, **Refining critical moves**, and **Finalizing** rather than one misleading linear percentage.
7. Confirm stable moves do not all continue automatically to depth 20.
8. Confirm the popup reaches its completed summary before any optional selected-move continuation request in Deep Review.

Expected: progressive results, live depth, selective refinement, responsive navigation, and popup completion independent of optional lazy continuations.

Result: **NOT RUN**
Evidence: ________________________________________________

## Test L — PGN export

1. Complete a review of `tests/fixtures/chesscom-low-rating-001.pgn`.
2. Under Game summary, open **Export PGN**.
3. Download and copy both Clean PGN and Analysis PGN.
4. Re-import the Analysis PGN.
5. Confirm 118 plies, result `0-1`, and final `59...Qg2#` remain present.
6. Confirm CRL evaluation, depth, classification, Estimated Accuracy, best move, and PV comments are visible.
7. Confirm the filename contains player names, date, and export kind, with no reserved characters.

Expected: both local export forms work; annotations remain human-readable; re-import reconstructs the identical mainline and final position. Opening Export alone does not start analysis.

Result: **NOT RUN**
Evidence: ________________________________________________

## Test M — Popup-first review lifecycle

- [ ] Start completed-game analysis from the popup.
- [ ] Progress is visible with current ply, total plies, real engine depth, and engine name.
- [ ] Close the popup while analysis is running.
- [ ] Reopen the popup.
- [ ] Analysis did not restart from the first position.
- [ ] Current progress was restored.
- [ ] Final White Estimated Accuracy is displayed.
- [ ] Final Black Estimated Accuracy is displayed.
- [ ] Every move has one of the six simplified Vietnamese classifications.
- [ ] White and Black moves with the same move number appear on one row.
- [ ] No full chessboard or evaluation graph is rendered in the popup.
- [ ] **Xem phân tích sâu** opens the dedicated review tab.
- [ ] Deep Review loads the same analysis ID and does not start a fresh full-game run.
- [ ] Clean PGN and Analysis PGN export still work from the available review UI.

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
Progressive performance: **NOT RUN**
PGN export: **NOT RUN**
Popup-first lifecycle: **NOT RUN**

Overall manual acceptance: **NOT RUN**
