import type { GameReview } from "../analysis/analysisTypes";
import { toDisplayClassification, type DisplayClassification } from "./displayClassification";
import type { AnalysisPhase } from "../analysis/analysisPerformance";

export type ReviewSummaryStatus = "queued" | "analyzing" | "completed" | "cancelled" | "failed";
export interface ReviewSummaryMove {
  ply: number;
  moveNumber: number;
  color: "white" | "black";
  san: string;
  displayClassification: DisplayClassification;
}
export interface ReviewSummary {
  analysisId: string;
  status: ReviewSummaryStatus;
  currentPly: number;
  totalPlies: number;
  currentDepth?: number;
  targetDepth?: number;
  phase?: AnalysisPhase;
  phaseCompleted?: number;
  phaseTotal?: number;
  whiteName: string;
  blackName: string;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  moves: ReviewSummaryMove[];
  error?: string;
}

export function isReviewSummary(value: unknown): value is ReviewSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<ReviewSummary>;
  return typeof summary.analysisId === "string" && summary.analysisId.length > 0 && summary.analysisId.length <= 128
    && ["queued", "analyzing", "completed", "cancelled", "failed"].includes(summary.status ?? "")
    && typeof summary.currentPly === "number" && typeof summary.totalPlies === "number"
    && typeof summary.whiteName === "string" && typeof summary.blackName === "string" && Array.isArray(summary.moves);
}

export function createQueuedSummary(analysisId: string, whiteName: string, blackName: string, totalPlies: number): ReviewSummary {
  return { analysisId, status: "queued", currentPly: 0, totalPlies, whiteName, blackName, moves: [] };
}

export function completedReviewSummary(analysisId: string, review: GameReview): ReviewSummary {
  return {
    analysisId, status: "completed", currentPly: review.moves.length, totalPlies: review.moves.length,
    whiteName: review.game.headers.White ?? "White", blackName: review.game.headers.Black ?? "Black",
    whiteAccuracy: review.whiteAccuracy, blackAccuracy: review.blackAccuracy,
    moves: review.moves.map((move) => ({
      ply: move.ply, moveNumber: move.moveNumber, color: move.color, san: move.san,
      displayClassification: toDisplayClassification(move),
    })),
  };
}

export interface FullMoveRow { moveNumber: number; white?: ReviewSummaryMove; black?: ReviewSummaryMove }
export function groupSummaryMoves(moves: ReviewSummaryMove[]): FullMoveRow[] {
  const rows = new Map<number, FullMoveRow>();
  for (const move of moves) {
    const row = rows.get(move.moveNumber) ?? { moveNumber: move.moveNumber };
    row[move.color] = move;
    rows.set(move.moveNumber, row);
  }
  return [...rows.values()].sort((a, b) => a.moveNumber - b.moveNumber);
}
