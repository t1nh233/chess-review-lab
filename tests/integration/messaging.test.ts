import { describe, expect, it } from "vitest";
import { isExtensionMessage } from "../../src/background/messages";
import { authorizeReviewPayload } from "../../src/background/serviceWorker";
describe("service worker authorization", () => {
  it("rejects malformed messages", () => expect(isExtensionMessage({ type:"START_REVIEW", pgn:7, safetyState:"SAFE_IMPORTED_PGN" })).toBe(false));
  it("rejects forged safety states", () => expect(isExtensionMessage({ type:"START_REVIEW", pgn:"1. e4", safetyState:"SAFE_SOMEHOW" })).toBe(false));
  it("accepts known safety states for explicit authorization", () => {
    expect(isExtensionMessage({ type:"START_REVIEW", pgn:"1. e4", safetyState:"SAFE_IMPORTED_PGN" })).toBe(true);
    expect(isExtensionMessage({ type:"START_REVIEW", pgn:"1. e4", safetyState:"LIVE_GAME" })).toBe(true);
  });
  it("cannot authorize live or unknown analysis", () => { expect(() => authorizeReviewPayload("1. e4", "LIVE_GAME")).toThrow(/progress/); expect(() => authorizeReviewPayload("1. e4", "UNKNOWN")).toThrow(/verify/); });
  it("authorizes explicit imports", () => expect(authorizeReviewPayload("1. e4 e5", "SAFE_IMPORTED_PGN").safetyState).toBe("SAFE_IMPORTED_PGN"));
  it("validates analysis dismissal identifiers", () => {
    expect(isExtensionMessage({ type: "DISMISS_ANALYSIS", analysisId: "analysis-123" })).toBe(true);
    expect(isExtensionMessage({ type: "DISMISS_ANALYSIS", analysisId: "" })).toBe(false);
  });
  it("validates completed-game messages without accepting unsafe metadata", () => {
    expect(isExtensionMessage({ type: "START_COMPLETED_ANALYSIS", tabId: 7, expectedGameId: "123" })).toBe(true);
    expect(isExtensionMessage({ type: "START_COMPLETED_ANALYSIS", tabId: 0 })).toBe(false);
    expect(isExtensionMessage({ type: "GAME_COMPLETED_AVAILABLE", metadata: { gameId: "123", gameUrl: "https://www.chess.com/game/live/123", result: "0-1" } })).toBe(true);
    expect(isExtensionMessage({ type: "GAME_COMPLETED_AVAILABLE", metadata: { gameUrl: "https://evil.example/game/123", result: "0-1" } })).toBe(false);
  });
});
