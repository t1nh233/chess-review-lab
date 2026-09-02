import { describe, expect, it } from "vitest";
import { detectGreatMove } from "../../src/analysis/greatMove";
import { detectBrilliantMove } from "../../src/analysis/brilliant";
import { detectMissedOpportunity } from "../../src/analysis/missedOpportunity";
describe("special classifications", () => {
  it("detects a unique Great candidate", () => expect(detectGreatMove({ isNearBest:true, uniquenessGap:.24, outcomeSwing:.2, materialChange:0, legalMoveCount:22 }).matched).toBe(true));
  it("detects a sound tactical sacrifice", () => expect(detectBrilliantMove({ isNearBest:true, materialSacrifice:3, evalLossCp:12, moverEvalCpAfter:90, moverEvalCpBefore:20, pvMaterialDeficitPlies:4, forcedRecapture:false, tacticallyMeaningful:true }).matched).toBe(true));
  it("rejects a routine exchange", () => expect(detectBrilliantMove({ isNearBest:true, materialSacrifice:0, evalLossCp:0, moverEvalCpAfter:80, moverEvalCpBefore:70, pvMaterialDeficitPlies:0, forcedRecapture:true, tacticallyMeaningful:false }).matched).toBe(false));
  it("tags a missed opportunity", () => expect(detectMissedOpportunity(.22,.16)).toBe(true));
});
