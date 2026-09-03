import type { MoveReview } from "../analysis/analysisTypes";
import type { DisplayClassification } from "../presentation/displayClassification";

export type { DisplayClassification } from "../presentation/displayClassification";
export { DISPLAY_CLASSIFICATION_LABELS, DISPLAY_CLASSIFICATION_META } from "../presentation/displayClassification";

export function toDisplayClassification(move: Pick<MoveReview, "primaryClassification" | "tags">): DisplayClassification {
  if (move.primaryClassification === "brilliant") return "brilliant";
  if (move.primaryClassification === "great") return "great";
  if (move.primaryClassification === "blunder") return "blunder";
  if (move.tags.includes("missed_opportunity")) return "miss";
  if (move.primaryClassification === "mistake" || move.primaryClassification === "inaccuracy") return "mistake";
  return "best";
}
