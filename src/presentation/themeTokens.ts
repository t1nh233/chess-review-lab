import type { DisplayClassification } from "./displayClassification";

export const SOURCE_PALETTE = {
  primary: "#2A7C13",
  secondary: "#76C457",
  surface: "#FFF8CF",
  warmSurface: "#FBE6C2",
} as const;

export const CLASSIFICATION_THEME_TOKENS: Record<DisplayClassification, string> = {
  brilliant: "var(--classification-brilliant)",
  great: "var(--classification-great)",
  book: "var(--classification-book)",
  best: "var(--classification-best)",
  excellent: "var(--classification-excellent)",
  good: "var(--classification-good)",
  inaccuracy: "var(--classification-inaccuracy)",
  mistake: "var(--classification-mistake)",
  miss: "var(--classification-miss)",
  blunder: "var(--classification-blunder)",
};

export const SHARED_THEME_TOKENS = ["--background", "--panel", "--text", "--divider", "--selected", "--hover", "--focus"] as const;
