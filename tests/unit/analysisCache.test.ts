import { describe, expect, it } from "vitest";
import { isCachedReviewCompatible } from "../../src/storage/analysisCache";

describe("analysis cache compatibility", () => {
  const entry = {
    gameFingerprint: "abc",
    enginePreset: "balanced",
    engineVersion: "Stockfish 18",
    analysisModelVersion: "analysis-1.0",
    expectedPointsModelVersion: "ep-1.0",
    classifierVersion: "classifier-1.0",
    classifierMode: "compatibility" as const,
  };
  const identity = {
    fingerprint: "abc",
    preset: "balanced",
    engineVersion: "Stockfish 18",
    analysisModelVersion: "analysis-1.0",
    expectedPointsModelVersion: "ep-1.0",
    classifierVersion: "classifier-1.0",
    classifierMode: "compatibility" as const,
  };

  it("requires every analysis identity field to match", () => {
    expect(isCachedReviewCompatible(entry, identity)).toBe(true);
    for (const changed of [
      { engineVersion: "Stockfish 19" },
      { preset: "deep" },
      { fingerprint: "other" },
      { analysisModelVersion: "analysis-2.0" },
      { expectedPointsModelVersion: "ep-2.0" },
      { classifierVersion: "classifier-2.0" },
      { classifierMode: "strict" as const },
    ]) expect(isCachedReviewCompatible(entry, { ...identity, ...changed })).toBe(false);
  });

  it("rejects legacy records that lack required version fields", () => {
    expect(isCachedReviewCompatible({ gameFingerprint: "abc", enginePreset: "balanced", engineVersion: "Stockfish 18" }, identity)).toBe(false);
  });
});
