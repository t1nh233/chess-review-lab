import type { EnginePresetName } from "../analysis/analyzeGame";

export interface Settings {
  analysisQuality: EnginePresetName;
  boardOrientation: "auto" | "white" | "black";
  showBestMoveArrow: boolean;
  cachePreviousReviews: boolean;
  compatibilityClassifier: boolean;
  maxCachedReviews: number;
}
export const DEFAULT_SETTINGS: Settings = { analysisQuality: "balanced", boardOrientation: "auto", showBestMoveArrow: true, cachePreviousReviews: true, compatibilityClassifier: true, maxCachedReviews: 20 };

export function sanitizeSettings(value: unknown): Settings {
  const stored = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const quality = stored.analysisQuality;
  const orientation = stored.boardOrientation;
  const cacheLimit = stored.maxCachedReviews;
  return {
    analysisQuality: quality === "quick" || quality === "balanced" || quality === "deep" ? quality : DEFAULT_SETTINGS.analysisQuality,
    boardOrientation: orientation === "auto" || orientation === "white" || orientation === "black" ? orientation : DEFAULT_SETTINGS.boardOrientation,
    showBestMoveArrow: typeof stored.showBestMoveArrow === "boolean" ? stored.showBestMoveArrow : DEFAULT_SETTINGS.showBestMoveArrow,
    cachePreviousReviews: typeof stored.cachePreviousReviews === "boolean" ? stored.cachePreviousReviews : DEFAULT_SETTINGS.cachePreviousReviews,
    compatibilityClassifier: typeof stored.compatibilityClassifier === "boolean" ? stored.compatibilityClassifier : DEFAULT_SETTINGS.compatibilityClassifier,
    maxCachedReviews: typeof cacheLimit === "number" && Number.isFinite(cacheLimit)
      ? Math.min(100, Math.max(1, Math.round(cacheLimit)))
      : DEFAULT_SETTINGS.maxCachedReviews,
  };
}

export async function getSettings(): Promise<Settings> {
  if (typeof chrome === "undefined" || !chrome.storage) return DEFAULT_SETTINGS;
  const result = await chrome.storage.local.get("settings");
  return sanitizeSettings(result.settings);
}
export async function saveSettings(settings: Settings): Promise<void> { await chrome.storage.local.set({ settings }); }
