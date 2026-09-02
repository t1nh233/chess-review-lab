import { openDB, type DBSchema } from "idb";
import type { GameReview } from "../analysis/analysisTypes";

export interface CachedReview {
  analysisId: string; createdAt: number; gameFingerprint: string; pgn: string;
  engineVersion: string; enginePreset: string; analysisModelVersion: string;
  expectedPointsModelVersion: string; classifierVersion: string; classifierMode: "compatibility" | "strict";
  results: GameReview;
}
interface ReviewDb extends DBSchema { reviews: { key: string; value: CachedReview; indexes: { "by-created": number; "by-fingerprint": string } } }
const db = () => openDB<ReviewDb>("chess-review-lab", 1, { upgrade(database) { const store = database.createObjectStore("reviews", { keyPath: "analysisId" }); store.createIndex("by-created", "createdAt"); store.createIndex("by-fingerprint", "gameFingerprint"); } });

export interface CacheIdentity {
  fingerprint: string; preset: string; engineVersion: string; analysisModelVersion: string;
  expectedPointsModelVersion: string; classifierVersion: string; classifierMode: "compatibility" | "strict";
}

export function isCachedReviewCompatible(
  entry: Partial<Pick<CachedReview, "gameFingerprint" | "enginePreset" | "engineVersion" | "analysisModelVersion" | "expectedPointsModelVersion" | "classifierVersion" | "classifierMode">>,
  identity: CacheIdentity,
): boolean {
  return entry.gameFingerprint === identity.fingerprint
    && entry.enginePreset === identity.preset
    && entry.engineVersion === identity.engineVersion
    && entry.analysisModelVersion === identity.analysisModelVersion
    && entry.expectedPointsModelVersion === identity.expectedPointsModelVersion
    && entry.classifierVersion === identity.classifierVersion
    && entry.classifierMode === identity.classifierMode;
}

export async function findCachedReview(identity: CacheIdentity): Promise<CachedReview | undefined> {
  const matches = await (await db()).getAllFromIndex("reviews", "by-fingerprint", identity.fingerprint);
  return matches.find((entry) => isCachedReviewCompatible(entry, identity));
}
export async function saveCachedReview(review: CachedReview, maximum = 20): Promise<void> {
  const database = await db(); await database.put("reviews", review);
  const all = (await database.getAll("reviews")).sort((a, b) => b.createdAt - a.createdAt);
  await Promise.all(all.slice(maximum).map((entry) => database.delete("reviews", entry.analysisId)));
}
export async function listCachedReviews(): Promise<CachedReview[]> { return (await (await db()).getAll("reviews")).sort((a, b) => b.createdAt - a.createdAt); }
export async function getCachedReview(analysisId: string): Promise<CachedReview | undefined> { return (await db()).get("reviews", analysisId); }
export async function deleteCachedReview(id: string): Promise<void> { await (await db()).delete("reviews", id); }
