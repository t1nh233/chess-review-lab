import type { GameReview, MoveReview } from "../analysis/analysisTypes";

export interface ReviewSelection {
  selectedMove?: MoveReview;
  currentFen: string;
}

export function getReviewSelection(review: GameReview, selectedPly: number): ReviewSelection {
  const selectedMove = selectedPly > 0 ? review.moves[selectedPly - 1] : undefined;
  return { selectedMove, currentFen: selectedMove?.fenAfter ?? review.game.startingFen };
}

export function keyboardSelectedPly(currentPly: number, key: string, totalPlies: number): number | undefined {
  if (key === "ArrowLeft") return Math.max(0, currentPly - 1);
  if (key === "ArrowRight") return Math.min(totalPlies, currentPly + 1);
  if (key === "Home") return 0;
  if (key === "End") return totalPlies;
  return undefined;
}
