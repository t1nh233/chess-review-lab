import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChessComPageAdapter } from "../../src/adapters/chessCom/pageAdapter";
import { observeGameCompletion } from "../../src/adapters/chessCom/completionObserver";
import { readFileSync } from "node:fs";

const PGN = `[Event "Completed"]
[Result "1-0"]

1. e4 e5 1-0`;

function setPage(html: string, visibleText: string) {
  document.body.innerHTML = html;
  Object.defineProperty(document.body, "innerText", { configurable: true, value: visibleText });
}

describe("Chess.com page adapter", () => {
  const adapter = new ChessComPageAdapter();

  beforeEach(() => setPage("", ""));

  it("supports only the exact Chess.com host", () => {
    expect(adapter.supports("https://www.chess.com/game/live/123")).toBe(true);
    expect(adapter.supports("https://www.chess.com.evil.example/game/123")).toBe(false);
    expect(adapter.supports("not a URL")).toBe(false);
  });

  it("extracts PGN only with positive completed-game evidence", () => {
    setPage(`<div data-cy="game-over-modal"></div><textarea>${PGN}</textarea>`, "Game over 1-0");
    expect(adapter.inspect(document, "https://www.chess.com/game/live/123")).toMatchObject({
      safetyState: "SAFE_COMPLETED_GAME",
      pgn: PGN,
    });
  });

  it("gives live evidence precedence and withholds PGN", () => {
    setPage(`<div data-cy="game-over-modal"></div><div data-cy="game-clock"></div><textarea>${PGN}</textarea>`, "Game over 1-0 your turn");
    expect(adapter.inspect(document, "https://www.chess.com/game/live/123")).toMatchObject({
      safetyState: "LIVE_GAME",
      pgn: null,
    });
  });

  it("does not treat a retained passive clock as live after positive completion", () => {
    setPage(`<div data-cy="game-over-modal"></div><div data-cy="game-clock"></div><textarea>${PGN}</textarea>`, "Game over 1-0");
    expect(adapter.inspect(document, "https://www.chess.com/game/live/123").safetyState).toBe("SAFE_COMPLETED_GAME");
  });

  it("withholds PGN when completion cannot be verified", () => {
    setPage(`<textarea>${PGN}</textarea>`, "1-0");
    expect(adapter.inspect(document, "https://www.chess.com/game/live/123")).toMatchObject({
      safetyState: "UNKNOWN",
      pgn: null,
    });
  });

  it.each(["Checkmate 0-1", "White resigned 0-1", "Draw agreed 1/2-1/2"])("recognizes completed result evidence: %s", (visibleText) => {
    const result = visibleText.includes("1/2") ? "1/2-1/2" : "0-1";
    const pgn = PGN.replaceAll("1-0", result);
    setPage(`<div data-cy="game-over-modal"></div><textarea>${pgn}</textarea>`, visibleText);
    expect(adapter.inspect(document, "https://www.chess.com/game/live/987")).toMatchObject({
      safetyState: "SAFE_COMPLETED_GAME", completedGame: { gameId: "987", result, moveCount: 2 },
    });
  });

  it("keeps completed state and metadata when automatic PGN extraction fails", () => {
    setPage(`<div data-cy="game-over-modal"></div>`, "Game over by checkmate 0-1");
    expect(adapter.inspect(document, "https://www.chess.com/game/live/987")).toMatchObject({
      safetyState: "SAFE_COMPLETED_GAME", pgn: null, completedGame: { gameId: "987" },
    });
  });

  it("preserves the 118-ply completed fixture through 59...Qg2#", () => {
    const fixture = readFileSync("tests/fixtures/chesscom-low-rating-001.pgn", "utf8");
    setPage(`<div data-cy="game-over-modal"></div><textarea></textarea>`, "Checkmate 0-1");
    (document.querySelector("textarea") as HTMLTextAreaElement).value = fixture;
    const snapshot = adapter.inspect(document, "https://www.chess.com/game/live/123456");
    expect(snapshot).toMatchObject({ safetyState: "SAFE_COMPLETED_GAME", completedGame: { gameId: "123456", result: "0-1", moveCount: 118 } });
    expect(snapshot.pgn).toContain("59. Kg1 Qg2# 0-1");
  });

  it("detects LIVE_GAME to completed transitions without reload and emits metadata only", async () => {
    vi.useFakeTimers();
    setPage(`<button aria-label="Resign"></button>`, "Your turn");
    const completed = vi.fn();
    const stop = observeGameCompletion({ document, currentUrl: () => "https://www.chess.com/game/live/987", onCompleted: completed, delayMs: 10 });
    document.body.innerHTML = `<div data-cy="game-over-modal"></div><textarea></textarea>`;
    (document.querySelector("textarea") as HTMLTextAreaElement).value = PGN;
    Object.defineProperty(document.body, "innerText", { configurable: true, value: "Checkmate 1-0" });
    await vi.advanceTimersByTimeAsync(11);
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ gameId: "987", result: "1-0", moveCount: 2 }));
    expect(completed.mock.calls[0][0]).not.toHaveProperty("pgn");
    stop(); vi.useRealTimers();
  });
});
