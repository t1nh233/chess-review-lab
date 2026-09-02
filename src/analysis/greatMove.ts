import { DEFAULT_MODEL_CONFIG } from "../config/model";
import type { SpecialMoveDetection } from "./specialTypes";

export function detectGreatMove(input: { isNearBest: boolean; uniquenessGap: number; outcomeSwing: number; materialChange: number; legalMoveCount?: number }): SpecialMoveDetection {
  const unique = input.uniquenessGap >= DEFAULT_MODEL_CONFIG.great.uniquenessGap;
  const consequential = input.outcomeSwing >= DEFAULT_MODEL_CONFIG.great.swing || unique;
  const routine = Math.abs(input.materialChange) <= DEFAULT_MODEL_CONFIG.great.maxRoutineMaterialChange && input.legalMoveCount !== undefined && input.legalMoveCount <= 2;
  const matched = input.isNearBest && unique && consequential && !routine;
  return { matched, confidence: matched ? Math.min(0.95, 0.55 + input.uniquenessGap + input.outcomeSwing / 2) : 0, reasons: [
    ...(input.isNearBest ? ["The move is at or near the engine's first choice."] : []),
    ...(unique ? ["Other analyzed candidates lose substantial expected score."] : []),
    ...(routine ? ["The position appears routine or forced."] : []),
  ] };
}
