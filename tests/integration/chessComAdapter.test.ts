import { beforeEach, describe, expect, it } from "vitest";
import { ChessComPageAdapter } from "../../src/adapters/chessCom/pageAdapter";

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

  it("withholds PGN when completion cannot be verified", () => {
    setPage(`<textarea>${PGN}</textarea>`, "1-0");
    expect(adapter.inspect(document, "https://www.chess.com/game/live/123")).toMatchObject({
      safetyState: "UNKNOWN",
      pgn: null,
    });
  });
});
