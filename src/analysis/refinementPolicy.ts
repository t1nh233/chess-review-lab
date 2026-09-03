import config from "./refinementConfig.json";

export const REFINEMENT_CONFIG = config;
export const CLASSIFICATION_BOUNDARIES = [0.02, 0.05, 0.10, 0.20] as const;

export interface RefinementEvidence {
  expectedPointsLoss: number;
  criticality: number;
  bestMoveChanged: boolean;
  evaluationRangeCp: number;
  mateStatusChanged: boolean;
  greatCandidate: boolean;
  brilliantCandidate: boolean;
  missCandidate: boolean;
  onlyMoveCandidate: boolean;
  multiPvRequired: boolean;
}

export interface RefinementDecision {
  refine: boolean;
  level: "base" | "intermediate" | "maximum";
  reasons: string[];
}

export function isNearClassificationBoundary(loss: number, margin = REFINEMENT_CONFIG.classificationBoundaryMargin): boolean {
  return CLASSIFICATION_BOUNDARIES.some((boundary) => Math.abs(loss - boundary) <= margin);
}

export function shouldRefinePosition(evidence: RefinementEvidence): RefinementDecision {
  const maximumReasons: string[] = [];
  const intermediateReasons: string[] = [];
  if (isNearClassificationBoundary(evidence.expectedPointsLoss)) maximumReasons.push("classification_boundary");
  if (evidence.bestMoveChanged) maximumReasons.push("best_move_changed");
  if (evidence.mateStatusChanged) maximumReasons.push("mate_status_changed");
  if (evidence.brilliantCandidate) maximumReasons.push("brilliant_candidate");
  if (evidence.missCandidate) maximumReasons.push("miss_candidate");
  if (evidence.onlyMoveCandidate) maximumReasons.push("only_move_candidate");
  if (evidence.criticality >= REFINEMENT_CONFIG.highCriticalityThreshold) maximumReasons.push("high_criticality");
  if (evidence.evaluationRangeCp >= REFINEMENT_CONFIG.highEvaluationRangeCp) maximumReasons.push("high_eval_instability");
  if (maximumReasons.length) return { refine: true, level: "maximum", reasons: maximumReasons };
  if (evidence.greatCandidate) intermediateReasons.push("great_candidate");
  if (evidence.multiPvRequired) intermediateReasons.push("multipv_evidence");
  if (evidence.criticality >= REFINEMENT_CONFIG.criticalityThreshold) intermediateReasons.push("critical_position");
  if (evidence.evaluationRangeCp >= REFINEMENT_CONFIG.evaluationRangeCp) intermediateReasons.push("eval_instability");
  return intermediateReasons.length
    ? { refine: true, level: "intermediate", reasons: intermediateReasons }
    : { refine: false, level: "base", reasons: ["stable_far_from_boundary"] };
}
