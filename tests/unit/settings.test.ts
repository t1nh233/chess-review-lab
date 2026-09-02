import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../../src/storage/settings";

describe("settings", () => {
  it("preserves a complete valid settings object", () => {
    const settings = {
      analysisQuality: "deep",
      boardOrientation: "black",
      showBestMoveArrow: false,
      cachePreviousReviews: false,
      compatibilityClassifier: false,
      maxCachedReviews: 40,
    } as const;
    expect(sanitizeSettings(settings)).toEqual(settings);
  });

  it("falls back field-by-field for malformed stored values", () => {
    expect(sanitizeSettings({
      analysisQuality: "unlimited",
      boardOrientation: "sideways",
      showBestMoveArrow: "yes",
      cachePreviousReviews: 1,
      compatibilityClassifier: null,
      maxCachedReviews: Number.NaN,
    })).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps the cache limit to a safe integer range", () => {
    expect(sanitizeSettings({ maxCachedReviews: -3 }).maxCachedReviews).toBe(1);
    expect(sanitizeSettings({ maxCachedReviews: 500.8 }).maxCachedReviews).toBe(100);
  });
});
