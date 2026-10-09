import { describe, expect, it, vi } from "vitest";
import { fetchLatestFinishedGame } from "../../src/adapters/chessCom/latestGame";

const pgn = (id: string) => `[Event "Live Chess"]\n[Site "Chess.com"]\n[White "Alice"]\n[Black "Bob"]\n[Result "0-1"]\n[Link "https://www.chess.com/game/live/${id}"]\n\n1. f3 e5 2. g4 Qh4# 0-1`;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("latest finished game", () => {
  it("picks the newest game from the newest archive", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/archives")) return json({ archives: ["https://api.chess.com/pub/player/bob/games/2026/09", "https://api.chess.com/pub/player/bob/games/2026/10"] });
      return json({ games: [
        { url: "https://www.chess.com/game/live/1", pgn: pgn("1"), end_time: 100, white: { username: "Alice" }, black: { username: "Bob" } },
        { url: "https://www.chess.com/game/live/2", pgn: pgn("2"), end_time: 200, white: { username: "Alice" }, black: { username: "Bob" } },
      ] });
    }) as unknown as typeof fetch;
    const game = await fetchLatestFinishedGame("Bob", fetchFn);
    expect(game).toMatchObject({ gameId: "2", userColor: "black", opponent: "Alice", result: "0-1", endTime: 200_000 });
  });

  it("falls back to the previous month when the newest archive is empty", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/archives")) return json({ archives: ["https://api.chess.com/pub/player/bob/games/2026/09", "https://api.chess.com/pub/player/bob/games/2026/10"] });
      return url.endsWith("/10") ? json({ games: [] }) : json({ games: [{ url: "https://www.chess.com/game/live/9", pgn: pgn("9"), end_time: 50, white: { username: "Alice" }, black: { username: "Bob" } }] });
    }) as unknown as typeof fetch;
    await expect(fetchLatestFinishedGame("bob", fetchFn)).resolves.toMatchObject({ gameId: "9" });
  });

  it("returns undefined for an unknown player and rejects invalid usernames", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchLatestFinishedGame("nobody", fetchFn)).resolves.toBeUndefined();
    await expect(fetchLatestFinishedGame("bad name!", fetchFn)).rejects.toThrow();
  });
});

describe("games page", () => {
  it("lists games newest first with ratings, skips variants, and pages by month", async () => {
    const { fetchGamesPage } = await import("../../src/adapters/chessCom/latestGame");
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/archives")) return json({ archives: ["https://api.chess.com/pub/player/bob/games/2026/09", "https://api.chess.com/pub/player/bob/games/2026/10"] });
      return json({ games: [
        { url: "https://www.chess.com/game/live/1", pgn: pgn("1"), end_time: 100, time_class: "blitz", rules: "chess", white: { username: "Alice", rating: 1300 }, black: { username: "Bob", rating: 1250 } },
        { url: "https://www.chess.com/game/live/2", pgn: pgn("2"), end_time: 200, rules: "chess", white: { username: "Alice", rating: 1310 }, black: { username: "Bob", rating: 1260 } },
        { url: "https://www.chess.com/game/live/3", pgn: pgn("3"), end_time: 300, rules: "chess960", white: { username: "Alice" }, black: { username: "Bob" } },
      ] });
    }) as unknown as typeof fetch;
    const page0 = await fetchGamesPage("Bob", 0, fetchFn);
    expect(page0.games.map((game) => game.gameId)).toEqual(["2", "1"]);
    expect(page0.games[1]).toMatchObject({ timeClass: "blitz", userRating: 1250, opponentRating: 1300 });
    expect(page0.nextPage).toBe(1);
    expect((await fetchGamesPage("Bob", 1, fetchFn)).nextPage).toBeUndefined();
    expect((await fetchGamesPage("Bob", 5, fetchFn)).games).toEqual([]);
  });
});
