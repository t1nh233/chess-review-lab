export type AnalysisPhase = "quick" | "refinement" | "multiPvExpansion" | "lazyContinuation" | "finalizing";

export interface AnalysisSearchTiming {
  phase: AnalysisPhase;
  positionIndex: number;
  ply: number;
  targetDepth: number;
  actualDepth: number;
  multiPv: number;
  queueWaitMs: number;
  engineSearchDurationMs: number;
  nodes?: number;
  nps?: number;
  cache: "hit" | "miss";
}

export interface AnalysisPerformanceReport {
  totalDurationMs: number;
  popupSummaryDurationMs: number;
  optionalDeepAnalysisMs: number;
  baseOnlyPositionCount: number;
  refinedToDepth18Count: number;
  refinedToDepth20Count: number;
  multiPv3JobCount: number;
  jobs: AnalysisSearchTiming[];
  phaseDurationMs: Record<AnalysisPhase, number>;
}
