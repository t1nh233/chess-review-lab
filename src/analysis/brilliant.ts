import { DEFAULT_MODEL_CONFIG } from "../config/model";
import type { SpecialMoveDetection } from "./specialTypes";

export function detectBrilliantMove(input: { isNearBest: boolean; materialSacrifice: number; evalLossCp: number; moverEvalCpAfter: number; moverEvalCpBefore: number; pvMaterialDeficitPlies: number; forcedRecapture: boolean; tacticallyMeaningful: boolean }): SpecialMoveDetection {
  const realSacrifice = input.materialSacrifice >= DEFAULT_MODEL_CONFIG.brilliant.minSacrifice && input.pvMaterialDeficitPlies >= 2;
  const sound = input.evalLossCp <= DEFAULT_MODEL_CONFIG.brilliant.maxEvalLossCp && input.moverEvalCpAfter >= -40;
  const notTrivial = input.moverEvalCpBefore < DEFAULT_MODEL_CONFIG.brilliant.maxWinningCp;
  const matched = input.isNearBest && realSacrifice && sound && notTrivial && !input.forcedRecapture && input.tacticallyMeaningful;
  const confidence = matched ? Math.min(0.96, 0.58 + input.materialSacrifice / 15 + input.pvMaterialDeficitPlies / 30) : 0;
  return { matched: matched && confidence >= DEFAULT_MODEL_CONFIG.brilliant.minConfidence, confidence, reasons: [
    ...(input.isNearBest ? ["The move is engine-approved."] : []),
    ...(realSacrifice ? ["Material remains invested along the analyzed continuation."] : []),
    ...(sound ? ["The sacrifice retains sufficient compensation."] : []),
    ...(input.forcedRecapture ? ["The move is a routine forced recapture."] : []),
  ] };
}
