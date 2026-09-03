import { EXPECTED_POINTS_MODEL_VERSION } from "./versions";

export interface ClassificationModelConfig {
  modelVersion: string;
  expectedPoints: {
    defaultRating: number; baseScaleCp: number; ratingScalePerPoint: number; minScaleCp: number; maxScaleCp: number;
    minPracticalFloor: number; maxPracticalFloor: number; lowRatingFloorStart: number; lowRatingFloorRange: number;
  };
  great: { uniquenessGap: number; swing: number; maxRoutineMaterialChange: number };
  brilliant: { minSacrifice: number; maxEvalLossCp: number; maxWinningCp: number; minConfidence: number };
  miss: { opportunityGain: number; opportunityGivenBack: number };
  accuracy: {
    decay: number; minWeight: number; maxWeight: number; forcedMoveWeightMultiplier: number;
    decidedPositionDiscount: number; minimumGameWeight: number; mateLossPenalty: number; aggregationPower: number;
  };
}

export const DEFAULT_MODEL_CONFIG: ClassificationModelConfig = {
  modelVersion: "classification-model-1.0",
  expectedPoints: {
    defaultRating: 1500, baseScaleCp: 190, ratingScalePerPoint: 0.035, minScaleCp: 180, maxScaleCp: 260,
    minPracticalFloor: 0.004, maxPracticalFloor: 0.02, lowRatingFloorStart: 1500, lowRatingFloorRange: 1000,
  },
  great: { uniquenessGap: 0.12, swing: 0.18, maxRoutineMaterialChange: 1.2 },
  brilliant: { minSacrifice: 1.8, maxEvalLossCp: 45, maxWinningCp: 600, minConfidence: 0.68 },
  miss: { opportunityGain: 0.18, opportunityGivenBack: 0.14 },
  accuracy: {
    decay: 5.2, minWeight: 0.45, maxWeight: 1.55, forcedMoveWeightMultiplier: 0.25,
    decidedPositionDiscount: 0.65, minimumGameWeight: 0.12, mateLossPenalty: 0.12, aggregationPower: 1.6,
  },
};

export const EXPECTED_POINTS_MODEL = { version: EXPECTED_POINTS_MODEL_VERSION } as const;
