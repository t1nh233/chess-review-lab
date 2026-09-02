import type { NormalizedEval } from "../engine/engineTypes";
import { DEFAULT_MODEL_CONFIG } from "../config/model";

export function expectedPoints(evaluation: NormalizedEval, playerRating = DEFAULT_MODEL_CONFIG.expectedPoints.defaultRating): number {
  if (evaluation.mate !== undefined) return evaluation.mate > 0 ? 0.9995 : evaluation.mate < 0 ? 0.0005 : 0.5;
  const cp = evaluation.cp ?? 0;
  const ratingDelta = Math.max(-700, Math.min(1000, playerRating - 1500));
  const scale = Math.max(180, DEFAULT_MODEL_CONFIG.expectedPoints.baseScaleCp + ratingDelta * DEFAULT_MODEL_CONFIG.expectedPoints.ratingScalePerPoint);
  return Math.max(0, Math.min(1, 1 / (1 + Math.exp(-cp / scale))));
}

export function moverExpectedPoints(evaluation: NormalizedEval, color: "white" | "black", rating?: number): number {
  const white = expectedPoints(evaluation, rating);
  return color === "white" ? white : 1 - white;
}
