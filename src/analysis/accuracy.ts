import { DEFAULT_MODEL_CONFIG } from "../config/model";
import type { MoveReview } from "./analysisTypes";

export interface MoveAccuracyContext {
  forced?: boolean;
  decidedness?: number;
  mateLoss?: boolean;
}

export function moveAccuracy(epLoss: number, criticality: number, context: MoveAccuracyContext = {}): { raw: number; weight: number; weighted: number } {
  const config = DEFAULT_MODEL_CONFIG.accuracy;
  const loss = Math.max(0, epLoss) + (context.mateLoss ? config.mateLossPenalty : 0);
  const raw = Math.max(0, Math.min(100, 100 * Math.exp(-config.decay * loss)));
  const criticalWeight = config.minWeight + (config.maxWeight - config.minWeight) * Math.max(0, Math.min(1, criticality));
  const decidedness = Math.max(0, Math.min(1, context.decidedness ?? 0));
  const decisionRelevance = 1 - config.decidedPositionDiscount * decidedness * (1 - Math.min(1, loss / 0.2));
  const forcedFactor = context.forced ? config.forcedMoveWeightMultiplier : 1;
  const weight = Math.max(config.minimumGameWeight, criticalWeight * decisionRelevance * forcedFactor);
  return { raw, weight, weighted: raw * weight };
}

export function gameAccuracy(moves: Pick<MoveReview, "estimatedAccuracy" | "accuracyWeight">[]): number {
  if (!moves.length) return 0;
  const weight = moves.reduce((sum, move) => sum + move.accuracyWeight, 0);
  if (weight <= 0) return 0;
  const power = DEFAULT_MODEL_CONFIG.accuracy.aggregationPower;
  const poweredError = moves.reduce((sum, move) => sum + Math.pow(100 - Math.max(0, Math.min(100, move.estimatedAccuracy)), power) * move.accuracyWeight, 0) / weight;
  return Math.max(0, Math.min(100, 100 - Math.pow(poweredError, 1 / power)));
}
