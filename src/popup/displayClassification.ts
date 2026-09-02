import type { MoveReview } from "../analysis/analysisTypes";

export type DisplayClassification = "brilliant" | "great" | "best" | "mistake" | "miss" | "blunder";

export const DISPLAY_CLASSIFICATION_LABELS: Record<DisplayClassification, string> = {
  brilliant: "Thiên tài",
  great: "Tuyệt",
  best: "Tốt nhất",
  mistake: "Sai lầm",
  miss: "Bỏ lỡ",
  blunder: "Nước sai lầm ngớ ngẩn",
};

export function toDisplayClassification(move: Pick<MoveReview, "primaryClassification" | "tags">): DisplayClassification {
  if (move.primaryClassification === "brilliant") return "brilliant";
  if (move.primaryClassification === "great") return "great";
  if (move.primaryClassification === "blunder") return "blunder";
  if (move.tags.includes("missed_opportunity")) return "miss";
  if (move.primaryClassification === "mistake" || move.primaryClassification === "inaccuracy") return "mistake";
  return "best";
}
