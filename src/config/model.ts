import { EXPECTED_POINTS_MODEL_VERSION } from "./versions";

export interface ClassificationModelConfig {
  modelVersion: string;
  expectedPoints: { defaultRating: number; baseScaleCp: number; ratingScalePerPoint: number };
  great: { uniquenessGap: number; swing: number; maxRoutineMaterialChange: number };
  brilliant: { minSacrifice: number; maxEvalLossCp: number; maxWinningCp: number; minConfidence: number };
  miss: { opportunityGain: number; opportunityGivenBack: number };
  accuracy: { decay: number; minWeight: number; maxWeight: number };
}

export const DEFAULT_MODEL_CONFIG: ClassificationModelConfig = {
  modelVersion: "classification-model-1.0",
  expectedPoints: { defaultRating: 1500, baseScaleCp: 260, ratingScalePerPoint: 0.035 },
  great: { uniquenessGap: 0.12, swing: 0.18, maxRoutineMaterialChange: 1.2 },
  brilliant: { minSacrifice: 1.8, maxEvalLossCp: 45, maxWinningCp: 600, minConfidence: 0.68 },
  miss: { opportunityGain: 0.18, opportunityGivenBack: 0.14 },
  accuracy: { decay: 5.2, minWeight: 0.45, maxWeight: 1.55 },
};

export const EXPECTED_POINTS_MODEL = { version: EXPECTED_POINTS_MODEL_VERSION } as const;
