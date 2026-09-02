import { describe, expect, it } from "vitest";
import { parsePgn } from "../../src/chess/pgn";
import blackBlunder from "../fixtures/black-blunder.pgn?raw";
import cleanGame from "../fixtures/clean-game.pgn?raw";
import draw from "../fixtures/draw.pgn?raw";
import missedMate from "../fixtures/missed-mate.pgn?raw";
import ordinaryExchange from "../fixtures/ordinary-exchange.pgn?raw";
import promotion from "../fixtures/promotion.pgn?raw";
import queenBlunder from "../fixtures/queen-blunder.pgn?raw";
import tacticalSacrifice from "../fixtures/tactical-sacrifice.pgn?raw";

const fixtures = { blackBlunder, cleanGame, draw, missedMate, ordinaryExchange, promotion, queenBlunder, tacticalSacrifice };

describe("golden PGN fixtures", () => {
  for (const [name, pgn] of Object.entries(fixtures)) {
    it(`parses ${name}`, () => {
      const game = parsePgn(pgn);
      expect(game.moves.length).toBeGreaterThan(0);
      expect(game.moves.every((move) => move.fenBefore && move.fenAfter && move.uci && move.san)).toBe(true);
    });
  }
});
