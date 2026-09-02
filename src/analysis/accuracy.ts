import { DEFAULT_MODEL_CONFIG } from "../config/model";
import type { MoveReview } from "./analysisTypes";

export function moveAccuracy(epLoss: number, criticality: number): { raw: number; weight: number; weighted: number } {
  const raw = Math.max(0, Math.min(100, 100 * Math.exp(-DEFAULT_MODEL_CONFIG.accuracy.decay * Math.max(0, epLoss))));
  const weight = DEFAULT_MODEL_CONFIG.accuracy.minWeight + (DEFAULT_MODEL_CONFIG.accuracy.maxWeight - DEFAULT_MODEL_CONFIG.accuracy.minWeight) * Math.max(0, Math.min(1, criticality));
  return { raw, weight, weighted: raw * weight };
}

export function gameAccuracy(moves: Pick<MoveReview, "estimatedAccuracy" | "accuracyWeight">[]): number {
  if (!moves.length) return 0;
  const weight = moves.reduce((sum, move) => sum + move.accuracyWeight, 0);
  return Math.max(0, Math.min(100, moves.reduce((sum, move) => sum + move.estimatedAccuracy * move.accuracyWeight, 0) / weight));
}
