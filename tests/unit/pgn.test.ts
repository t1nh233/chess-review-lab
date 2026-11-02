import { describe, expect, it } from "vitest";
import { parsePgn } from "../../src/chess/pgn";
import { CHECKMATE, CLEAN_GAME, EN_PASSANT, PROMOTION } from "../fixtures/games";

describe("parsePgn", () => {
  it("parses a normal game and ratings", () => { const game = parsePgn(CLEAN_GAME); expect(game.moves).toHaveLength(17); expect(game.whiteRating).toBe(1600); expect(game.moves[8].uci).toBe("e1g1"); });
  it("parses promotion", () => { const game = parsePgn(PROMOTION); expect(game.moves[0]).toMatchObject({ san: "a8=Q", uci: "a7a8q" }); });
  it("parses castling", () => { const game = parsePgn(CLEAN_GAME); expect(game.moves.some((move) => move.san === "O-O")).toBe(true); });
  it("parses en passant", () => { const game = parsePgn(EN_PASSANT); expect(game.moves.at(-1)?.uci).toBe("e5d6"); });
  it("preserves a checkmating SAN move", () => { const game = parsePgn(CHECKMATE); expect(game.moves.at(-1)).toMatchObject({ san: "Qh4#", uci: "d8h4" }); });
  it("accepts comments without treating them as moves", () => { const game = parsePgn("1. e4 {Center control} e5 2. Nf3 *"); expect(game.moves.map((move) => move.san)).toEqual(["e4", "e5", "Nf3"]); });
  it("rejects invalid PGN with a readable error", () => expect(() => parsePgn("1. e4 e5 2. ThisIsNotAMove")).toThrow(/Không đọc được PGN/));
});

import { bookPlyCount } from "../../src/chess/openingBook";
describe("opening book plies from Chess.com ECOUrl", () => {
  it.each([
    ["https://www.chess.com/openings/Queens-Pawn-Opening-Horwitz-Defense-2.c4-c5-3.d5-exd5", 6],
    ["https://www.chess.com/openings/Sicilian-Defense-2.Nf3-d6-3.d4-cxd4", 6],
    ["https://www.chess.com/openings/Italian-Game-3.Bc4", 5],
    ["https://www.chess.com/openings/Kings-Gambit-2...exf4-3.Nf3-g5-4.h4-g4-5.Ne5", 9],
    ["https://www.chess.com/openings/Ruy-Lopez-Opening-3.Bb5-a6-4.Ba4-Nf6-5.O-O-Be7", 10],
    ["https://www.chess.com/openings/Italian-Game", 0],
    [undefined, 0],
  ])("%s -> %d", (url, expected) => expect(bookPlyCount(url as string | undefined)).toBe(expected));
});

import { openingNameFromUrl } from "../../src/chess/openingBook";
describe("move clocks and opening names", () => {
  it("derives time spent per move from [%clk] comments, base time and increment", () => {
    const pgn = `[Event "Live Chess"]\n[White "A"]\n[Black "B"]\n[Result "1-0"]\n[TimeControl "60+1"]\n\n1. e4 {[%clk 0:01:00]} 1... e5 {[%clk 0:00:59.5]} 2. Nf3 {[%clk 0:00:58]} 2... Nc6 {[%clk 0:00:58.2]} 1-0`;
    const game = parsePgn(pgn);
    // White: 60 + 1 - 60 = 1.0, then 60 + 1 - 58 = 3.0. Black: 60 + 1 - 59.5 = 1.5, then 59.5 + 1 - 58.2 = 2.3.
    expect(game.moves.map((move) => move.spentSeconds)).toEqual([1, 1.5, 3, 2.3]);
    expect(game.moves[2].clockSeconds).toBe(58);
  });
  it("skips timing when clock comments do not cover every move", () => {
    const game = parsePgn(`[White "A"]\n[Black "B"]\n[TimeControl "60+1"]\n\n1. e4 {[%clk 0:01:00]} e5 2. Nf3 *`);
    expect(game.moves.every((move) => move.spentSeconds === undefined)).toBe(true);
  });
  it("names the opening from a Chess.com ECOUrl", () => {
    expect(openingNameFromUrl("https://www.chess.com/openings/Caro-Kann-Defense-Hillbilly-Attack-2.c4-d5")).toBe("Caro Kann Defense Hillbilly Attack");
    expect(openingNameFromUrl("https://www.chess.com/openings/Italian-Game")).toBe("Italian Game");
    expect(openingNameFromUrl(undefined)).toBeUndefined();
  });
});
