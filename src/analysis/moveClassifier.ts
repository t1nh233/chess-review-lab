import type { PrimaryClassification } from "./analysisTypes";

export const CLASSIFICATION_THRESHOLDS = { excellent: 0.02, good: 0.05, inaccuracy: 0.10, mistake: 0.20 } as const;

export function classifyExpectedPointsLoss(loss: number): Exclude<PrimaryClassification, "brilliant" | "great" | "best"> {
  const value = Math.max(0, loss);
  if (value <= CLASSIFICATION_THRESHOLDS.excellent) return "excellent";
  if (value <= CLASSIFICATION_THRESHOLDS.good) return "good";
  if (value <= CLASSIFICATION_THRESHOLDS.inaccuracy) return "inaccuracy";
  if (value <= CLASSIFICATION_THRESHOLDS.mistake) return "mistake";
  return "blunder";
}

export function classifyMove(input: { epLoss: number; playedMove: string; bestMove?: string; engineRank?: number; evalLossCp?: number; allowEquivalentBest?: boolean }): PrimaryClassification {
  const nearEquivalent = input.allowEquivalentBest !== false && input.engineRank !== undefined && input.evalLossCp !== undefined && input.evalLossCp <= 20;
  if (input.playedMove === input.bestMove || nearEquivalent) return "best";
  return classifyExpectedPointsLoss(input.epLoss);
}
