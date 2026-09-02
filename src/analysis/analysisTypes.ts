import type { ParsedGame } from "../chess/pgn";
import type { EngineLine, NormalizedEval } from "../engine/engineTypes";

export type PrimaryClassification = "brilliant" | "great" | "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
export type MoveTag = "missed_opportunity" | "only_move" | "forced" | "sacrifice" | "mate" | "game_ending";

export interface PositionReview {
  fen: string;
  evaluation: { white: NormalizedEval };
  bestMove?: string;
  lines: EngineLine[];
  analysisDepth: number;
  analysisStatus: "provisional" | "final";
}
export interface ClassificationEvidence {
  expectedPointsBefore: number; expectedPointsAfter: number; expectedPointsLoss: number;
  engineRank?: number; evalLossCp?: number; bestVsSecondGap?: number; materialDelta?: number;
  reasons: string[];
}
export interface MoveReview {
  ply: number; moveNumber: number; color: "white" | "black"; san: string; uci: string; fenBefore: string; fenAfter: string;
  evalBefore: NormalizedEval; evalAfter: NormalizedEval;
  expectedPointsBefore: number; expectedPointsAfter: number; expectedPointsLoss: number;
  estimatedAccuracy: number; accuracyWeight: number;
  primaryClassification: PrimaryClassification; tags: MoveTag[];
  bestMove?: string; principalVariation: string[]; criticality: number; explanation: string;
  continuationLines: EngineLine[];
  continuationsStatus?: "loading" | "ready";
  analysisDepth: number; analysisStatus: "provisional" | "final";
  evidence: ClassificationEvidence;
}
export interface GameReviewSummary {
  headline: string;
  counts: Record<"white" | "black", Record<PrimaryClassification, number>>;
  criticalPlies: number[];
  largestMistakePly?: number;
  specialPlies: number[];
}
export interface GameReview {
  game: ParsedGame; whiteAccuracy: number; blackAccuracy: number; moves: MoveReview[];
  positions: PositionReview[]; summary: GameReviewSummary;
  engineVersion: string; enginePreset: string; analysisModelVersion: string;
  expectedPointsModelVersion: string; classifierVersion: string; classifierMode: "compatibility" | "strict";
}
