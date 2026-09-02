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
  it("rejects invalid PGN with a readable error", () => expect(() => parsePgn("1. e4 e5 2. ThisIsNotAMove")).toThrow(/could not be parsed/i));
});
