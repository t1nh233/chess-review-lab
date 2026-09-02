import { describe, expect, it } from "vitest";
import { isReviewPayloadActive, REVIEW_PAYLOAD_TTL_MS } from "../../src/background/serviceWorker";

describe("review payload lifetime", () => {
  const now = 2_000_000;

  it("accepts a recent authorized payload", () => {
    expect(isReviewPayloadActive({ pgn: "1. e4", safetyState: "SAFE_IMPORTED_PGN", createdAt: now - 1 }, now)).toBe(true);
  });

  it("rejects expired, future, malformed, and unauthorized payloads", () => {
    expect(isReviewPayloadActive({ pgn: "1. e4", safetyState: "SAFE_IMPORTED_PGN", createdAt: now - REVIEW_PAYLOAD_TTL_MS - 1 }, now)).toBe(false);
    expect(isReviewPayloadActive({ pgn: "1. e4", safetyState: "SAFE_IMPORTED_PGN", createdAt: now + 1 }, now)).toBe(false);
    expect(isReviewPayloadActive({ pgn: "", safetyState: "SAFE_IMPORTED_PGN", createdAt: now }, now)).toBe(false);
    expect(isReviewPayloadActive({ pgn: "1. e4", safetyState: "LIVE_GAME", createdAt: now }, now)).toBe(false);
  });
});
