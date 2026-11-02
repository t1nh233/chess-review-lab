import { CLASSIFICATION_THEME_TOKENS } from "./themeTokens";

/**
 * The ten categories shown by Chess.com's Game Review (full view). Brief view shows only BRIEF_CLASSIFICATIONS.
 * Expected Points loss boundaries (published by Chess.com): Best 0, Excellent <=0.02, Good <=0.05,
 * Inaccuracy <=0.10, Mistake <=0.20, Blunder >0.20. Brilliant, Great, Book and Miss are rule based.
 */
export type DisplayClassification = "brilliant" | "great" | "book" | "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "miss" | "blunder";

export interface DisplayClassificationMeta {
  label: string;
  icon: string;
  semanticColor: string;
}

export const DISPLAY_CLASSIFICATIONS: readonly DisplayClassification[] = ["brilliant", "great", "book", "best", "excellent", "good", "inaccuracy", "mistake", "miss", "blunder"];
/** Rows of the brief summary; Brilliant is added automatically when either player has one. */
export const BRIEF_CLASSIFICATIONS: readonly DisplayClassification[] = ["great", "best", "excellent", "mistake", "miss", "blunder"];

export const DISPLAY_CLASSIFICATION_META: Record<DisplayClassification, DisplayClassificationMeta> = {
  brilliant: { label: "Thiên tài", icon: "!!", semanticColor: CLASSIFICATION_THEME_TOKENS.brilliant },
  great: { label: "Tuyệt", icon: "!", semanticColor: CLASSIFICATION_THEME_TOKENS.great },
  book: { label: "Khai cuộc", icon: "≡", semanticColor: CLASSIFICATION_THEME_TOKENS.book },
  best: { label: "Tốt nhất", icon: "★", semanticColor: CLASSIFICATION_THEME_TOKENS.best },
  excellent: { label: "Xuất sắc", icon: "↑", semanticColor: CLASSIFICATION_THEME_TOKENS.excellent },
  good: { label: "Tốt", icon: "✓", semanticColor: CLASSIFICATION_THEME_TOKENS.good },
  inaccuracy: { label: "Thiếu chính xác", icon: "?!", semanticColor: CLASSIFICATION_THEME_TOKENS.inaccuracy },
  mistake: { label: "Sai lầm", icon: "?", semanticColor: CLASSIFICATION_THEME_TOKENS.mistake },
  miss: { label: "Bỏ lỡ", icon: "✕", semanticColor: CLASSIFICATION_THEME_TOKENS.miss },
  blunder: { label: "Sai nghiêm trọng", icon: "??", semanticColor: CLASSIFICATION_THEME_TOKENS.blunder },
};

export const DISPLAY_CLASSIFICATION_LABELS = Object.fromEntries(
  DISPLAY_CLASSIFICATIONS.map((classification) => [classification, DISPLAY_CLASSIFICATION_META[classification].label]),
) as Record<DisplayClassification, string>;

export type DisplayClassificationCounts = Record<DisplayClassification, number>;
export function emptyDisplayClassificationCounts(): DisplayClassificationCounts {
  return { brilliant: 0, great: 0, book: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0 };
}
export function countDisplayClassifications<T extends { color: "white" | "black"; displayClassification: DisplayClassification }>(moves: readonly T[]) {
  const counts = { white: emptyDisplayClassificationCounts(), black: emptyDisplayClassificationCounts() };
  for (const move of moves) counts[move.color][move.displayClassification] += 1;
  return counts;
}
