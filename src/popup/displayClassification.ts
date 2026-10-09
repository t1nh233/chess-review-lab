import type { MoveReview } from "../analysis/analysisTypes";
import type { DisplayClassification } from "../presentation/displayClassification";

export type { DisplayClassification } from "../presentation/displayClassification";
export { DISPLAY_CLASSIFICATION_LABELS, DISPLAY_CLASSIFICATION_META } from "../presentation/displayClassification";

/**
 * Precedence: Book, Brilliant, Great, Blunder, Miss, Mistake, Inaccuracy, then the Expected Points tiers
 * Best / Excellent / Good (Best = engine move, Excellent <= 0.02 EP lost, Good <= 0.05).
 */
export function toDisplayClassification(move: Pick<MoveReview, "primaryClassification" | "tags">): DisplayClassification {
  if (move.tags.includes("book") && move.primaryClassification !== "blunder" && move.primaryClassification !== "mistake") return "book";
  if (move.primaryClassification === "brilliant") return "brilliant";
  if (move.primaryClassification === "great") return "great";
  if (move.primaryClassification === "blunder") return "blunder";
  if (move.tags.includes("missed_opportunity")) return "miss";
  if (move.primaryClassification === "mistake") return "mistake";
  if (move.primaryClassification === "inaccuracy") return "inaccuracy";
  if (move.primaryClassification === "excellent") return "excellent";
  if (move.primaryClassification === "good") return "good";
  return "best";
}
