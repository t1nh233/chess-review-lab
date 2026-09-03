import type { NormalizedEval } from "../engine/engineTypes";
import { DEFAULT_MODEL_CONFIG } from "../config/model";

export function resolvedPlayerRating(playerRating?: number): number {
  return Number.isFinite(playerRating) && (playerRating ?? 0) > 0 ? playerRating! : DEFAULT_MODEL_CONFIG.expectedPoints.defaultRating;
}

export function ratingForMover(ratings: { whiteRating?: number; blackRating?: number }, color: "white" | "black"): number {
  return resolvedPlayerRating(color === "white" ? ratings.whiteRating : ratings.blackRating);
}

export function expectedPoints(evaluation: NormalizedEval, playerRating = DEFAULT_MODEL_CONFIG.expectedPoints.defaultRating): number {
  if (evaluation.mate !== undefined) return evaluation.mate > 0 ? 0.9995 : evaluation.mate < 0 ? 0.0005 : 0.5;
  const cp = evaluation.cp ?? 0;
  const rating = resolvedPlayerRating(playerRating);
  const config = DEFAULT_MODEL_CONFIG.expectedPoints;
  const scale = Math.max(config.minScaleCp, Math.min(config.maxScaleCp,
    config.baseScaleCp + (config.lowRatingFloorStart - rating) * config.ratingScalePerPoint));
  const logistic = 1 / (1 + Math.exp(-cp / scale));
  const lowRatingFactor = Math.max(0, Math.min(1, (config.lowRatingFloorStart - rating) / config.lowRatingFloorRange));
  const floor = Math.min(config.maxPracticalFloor, config.minPracticalFloor + lowRatingFactor * (config.maxPracticalFloor - config.minPracticalFloor));
  return Math.max(0, Math.min(1, floor + (1 - 2 * floor) * logistic));
}

export function moverExpectedPoints(evaluation: NormalizedEval, color: "white" | "black", rating?: number): number {
  const white = expectedPoints(evaluation, rating);
  return color === "white" ? white : 1 - white;
}
