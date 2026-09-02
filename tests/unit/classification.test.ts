import { describe, expect, it } from "vitest";
import { classifyExpectedPointsLoss, classifyMove } from "../../src/analysis/moveClassifier";
describe("classification boundaries", () => {
  it.each([[0,"excellent"],[.01,"excellent"],[.02,"excellent"],[.021,"good"],[.05,"good"],[.051,"inaccuracy"],[.10,"inaccuracy"],[.101,"mistake"],[.20,"mistake"],[.201,"blunder"]] as const)("classifies %s as %s", (loss, expected) => expect(classifyExpectedPointsLoss(loss)).toBe(expected));
  it("only marks matching or near-equivalent engine choices Best", () => { expect(classifyMove({ epLoss:0, playedMove:"e2e4", bestMove:"e2e4" })).toBe("best"); expect(classifyMove({ epLoss:0, playedMove:"d2d4", bestMove:"e2e4" })).toBe("excellent"); });
  it("reserves Best for PV1 when compatibility equivalence is disabled", () => {
    expect(classifyMove({ epLoss: 0, playedMove: "d2d4", bestMove: "e2e4", engineRank: 2, evalLossCp: 10, allowEquivalentBest: true })).toBe("best");
    expect(classifyMove({ epLoss: 0, playedMove: "d2d4", bestMove: "e2e4", engineRank: 2, evalLossCp: 10, allowEquivalentBest: false })).toBe("excellent");
  });
});
