import { describe, expect, it } from "vitest";
import { parseBestMove, parseInfoLine } from "../../src/engine/uciParser";
describe("UCI parser", () => {
  it("parses partial MultiPV progress", () => expect(parseInfoLine("info depth 18 multipv 2 score cp -34 nodes 12 nps 24000 pv d2d4 d7d5")).toMatchObject({ depth:18, multipv:2, scoreCp:-34, nodes:12, nps:24000, moves:["d2d4","d7d5"] }));
  it("parses mate and bestmove", () => { expect(parseInfoLine("info depth 20 score mate 3 pv h5h7")).toMatchObject({ mate:3 }); expect(parseBestMove("bestmove h5h7 ponder g8h7")).toBe("h5h7"); });
});
