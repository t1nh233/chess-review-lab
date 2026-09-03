export type DisplayClassification = "brilliant" | "great" | "best" | "mistake" | "miss" | "blunder";

export interface DisplayClassificationMeta {
  label: string;
  icon: "!!" | "!" | "★" | "?" | "✕" | "??";
  semanticColor: string;
}

export const DISPLAY_CLASSIFICATIONS: readonly DisplayClassification[] = ["brilliant", "great", "best", "mistake", "miss", "blunder"];

export const DISPLAY_CLASSIFICATION_META: Record<DisplayClassification, DisplayClassificationMeta> = {
  brilliant: { label: "Thiên tài", icon: "!!", semanticColor: "var(--classification-brilliant)" },
  great: { label: "Tuyệt", icon: "!", semanticColor: "var(--classification-great)" },
  best: { label: "Tốt nhất", icon: "★", semanticColor: "var(--classification-best)" },
  mistake: { label: "Sai lầm", icon: "?", semanticColor: "var(--classification-mistake)" },
  miss: { label: "Bỏ lỡ", icon: "✕", semanticColor: "var(--classification-miss)" },
  blunder: { label: "Nước sai lầm ngớ ngẩn", icon: "??", semanticColor: "var(--classification-blunder)" },
};

export const DISPLAY_CLASSIFICATION_LABELS = Object.fromEntries(
  DISPLAY_CLASSIFICATIONS.map((classification) => [classification, DISPLAY_CLASSIFICATION_META[classification].label]),
) as Record<DisplayClassification, string>;

export type DisplayClassificationCounts = Record<DisplayClassification, number>;
export function emptyDisplayClassificationCounts(): DisplayClassificationCounts {
  return { brilliant: 0, great: 0, best: 0, mistake: 0, miss: 0, blunder: 0 };
}
export function countDisplayClassifications<T extends { color: "white" | "black"; displayClassification: DisplayClassification }>(moves: readonly T[]) {
  const counts = { white: emptyDisplayClassificationCounts(), black: emptyDisplayClassificationCounts() };
  for (const move of moves) counts[move.color][move.displayClassification] += 1;
  return counts;
}
