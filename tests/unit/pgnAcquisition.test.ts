import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { extractChessComGameId } from "../../src/adapters/chessCom/completedGameIdentity";
import {
  acquireCompletedGamePgn,
  acquireCompletedGamePgnWithRetry,
  monthlyArchiveUrl,
  selectExactApiGame,
  validateAcquiredPgn,
  type PgnCache,
} from "../../src/adapters/chessCom/pgnAcquisition";
import { parsePgn } from "../../src/chess/pgn";

const GAME_PGN = `[Event "Completed"]
[Site "https://www.chess.com/game/live/123"]
[White "Alice"]
[Black "Bob"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1`;

describe("completed Chess.com game identity", () => {
  it.each([
    "https://www.chess.com/game/123",
    "https://www.chess.com/game/live/123",
    "https://www.chess.com/game/daily/123",
    "https://www.chess.com/analysis/game/live/123/analysis",
  ])("extracts a generic game id from %s", (url) => expect(extractChessComGameId(url)).toBe("123"));

  it("selects the exact normalized game rather than the latest archive entry", () => {
    const games = [
      { url: "https://www.chess.com/game/live/123", pgn: GAME_PGN },
      { url: "https://www.chess.com/game/live/999", pgn: GAME_PGN.replaceAll("123", "999") },
    ];
    expect(selectExactApiGame(games, { gameId: "123", url: games[0].url })).toBe(games[0]);
    expect(selectExactApiGame(games, { gameId: "777", url: "https://www.chess.com/game/777" })).toBeUndefined();
  });

  it("uses the completed UTC month for the public archive endpoint", () => {
    expect(monthlyArchiveUrl("Some User", { url: "https://www.chess.com/game/123", endedAt: Date.UTC(2026, 0, 31, 23, 59) })).toBe("https://api.chess.com/pub/player/some%20user/games/2026/01");
  });
});

describe("completed-game PGN acquisition", () => {
  it("prefers validated page PGN and does not call the public API", async () => {
    const fetchFn = vi.fn();
    await expect(acquireCompletedGamePgn({ gameId: "123", url: "https://www.chess.com/game/live/123", whiteUsername: "Alice", blackUsername: "Bob", result: "0-1" }, { pagePgn: GAME_PGN, fetchFn })).resolves.toMatchObject({ status: "available", source: "page", pgn: GAME_PGN });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns the exact PubAPI game PGN and uses White lookup first", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => { void input; return new Response(JSON.stringify({ games: [{ url: "https://www.chess.com/game/999", pgn: GAME_PGN }, { url: "https://www.chess.com/game/live/123", pgn: GAME_PGN }] }), { status: 200 }); });
    const result = await acquireCompletedGamePgn({ gameId: "123", url: "https://www.chess.com/game/live/123", whiteUsername: "Alice", blackUsername: "Bob", result: "0-1" }, { fetchFn });
    expect(result).toMatchObject({ status: "available", source: "pubapi", pgn: GAME_PGN });
    expect(String(fetchFn.mock.calls[0][0])).toContain("/player/alice/games/");
  });

  it("falls back to Black lookup when White is unavailable", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => { void input; return new Response(JSON.stringify({ games: [{ url: "https://www.chess.com/game/live/123", pgn: GAME_PGN }] }), { status: 200 }); });
    await acquireCompletedGamePgn({ gameId: "123", url: "https://www.chess.com/game/live/123", blackUsername: "Bob", result: "0-1" }, { fetchFn });
    expect(String(fetchFn.mock.calls[0][0])).toContain("/player/bob/games/");
  });

  it("prefers an explicitly known local username", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => { void input; return new Response(JSON.stringify({ games: [{ url: "https://www.chess.com/game/live/123", pgn: GAME_PGN }] }), { status: 200 }); });
    await acquireCompletedGamePgn({ gameId: "123", url: "https://www.chess.com/game/live/123", localUsername: "LocalPlayer", whiteUsername: "Alice", blackUsername: "Bob" }, { fetchFn });
    expect(String(fetchFn.mock.calls[0][0])).toContain("/player/localplayer/games/");
  });

  it("reports propagation delay as pending, then unavailable after bounded retries", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ games: [] }), { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const identity = { gameId: "123", url: "https://www.chess.com/game/live/123", whiteUsername: "Alice" };
    await expect(acquireCompletedGamePgn(identity, { fetchFn, attempt: 0, maxAttempts: 4 })).resolves.toEqual({ status: "pending" });
    await expect(acquireCompletedGamePgnWithRetry(identity, { fetchFn, retryDelaysMs: [1, 2, 3], sleep })).resolves.toMatchObject({ status: "unavailable" });
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("rejects wrong-game and invalid PGN", () => {
    expect(() => validateAcquiredPgn(GAME_PGN, { gameId: "999", url: "https://www.chess.com/game/999" }, "https://www.chess.com/game/999")).toThrow(/different/);
    expect(() => validateAcquiredPgn("not a pgn", { gameId: "123", url: "https://www.chess.com/game/123" })).toThrow();
  });

  it("uses a validated cached PGN without a duplicate request", async () => {
    const cache: PgnCache = { get: vi.fn(async () => GAME_PGN), set: vi.fn(async () => undefined) };
    const fetchFn = vi.fn();
    await expect(acquireCompletedGamePgn({ gameId: "123", url: "https://www.chess.com/game/123" }, { cache, fetchFn })).resolves.toMatchObject({ status: "available", pgn: GAME_PGN });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("preserves the complete 118-ply fixture and final 59...Qg2#", async () => {
    const pgn = readFileSync("tests/fixtures/chesscom-low-rating-001.pgn", "utf8");
    const result = await acquireCompletedGamePgn({ gameId: "173311689452", url: "https://www.chess.com/game/live/173311689452", result: "0-1" }, { pagePgn: pgn });
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    const parsed = parsePgn(result.pgn);
    expect(parsed.moves).toHaveLength(118);
    expect(parsed.result).toBe("0-1");
    expect(parsed.moves.at(-1)?.san).toBe("Qg2#");
  });
});
