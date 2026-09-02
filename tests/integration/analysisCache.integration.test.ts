import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { GameReview } from "../../src/analysis/analysisTypes";
import { deleteCachedReview, listCachedReviews, saveCachedReview, type CachedReview } from "../../src/storage/analysisCache";

describe("IndexedDB analysis cache", () => {
  it("saves, lists, applies retention, and deletes review records", async () => {
    const makeEntry = (id: string, createdAt: number): CachedReview => ({
      analysisId: id,
      createdAt,
      gameFingerprint: `fingerprint-${id}`,
      pgn: "1. e4 e5 *",
      engineVersion: "Stockfish 18",
      enginePreset: "quick",
      analysisModelVersion: "analysis-1.0",
      expectedPointsModelVersion: "ep-1.0",
      classifierVersion: "classifier-1.0",
      classifierMode: "strict",
      results: {} as GameReview,
    });
    const ids = [`cache-${crypto.randomUUID()}`, `cache-${crypto.randomUUID()}`];
    await saveCachedReview(makeEntry(ids[0], 1), 1);
    await saveCachedReview(makeEntry(ids[1], 2), 1);
    const listed = await listCachedReviews();
    expect(listed.some((entry) => entry.analysisId === ids[0])).toBe(false);
    expect(listed.some((entry) => entry.analysisId === ids[1])).toBe(true);
    await deleteCachedReview(ids[1]);
    expect((await listCachedReviews()).some((entry) => entry.analysisId === ids[1])).toBe(false);
  });
});
