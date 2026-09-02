import { describe, expect, it } from "vitest";
import { PositionAnalysisCache } from "../../src/analysis/positionAnalysisCache";

describe("position analysis cache", () => {
  it("uses deeper and expanded results for compatible shallower requests", () => {
    const cache = new PositionAnalysisCache();
    const result = { bestMove: "e2e4", depth: 20, lines: [{ multipv: 1, depth: 20, scoreCp: 10, moves: ["e2e4"] }] };
    cache.set({ fen: "fen  value", engineVersion: "18", engineMode: "balanced", depth: 20, multiPv: 3 }, result);
    expect(cache.get({ fen: "fen value", engineVersion: "18", engineMode: "balanced", depth: 12, multiPv: 1 })).toBe(result);
    expect(cache.get({ fen: "fen value", engineVersion: "18", engineMode: "deep", depth: 12, multiPv: 1 })).toBeUndefined();
    expect(cache.get({ fen: "fen value", engineVersion: "18", engineMode: "balanced", depth: 22, multiPv: 1 })).toBeUndefined();
  });
});
