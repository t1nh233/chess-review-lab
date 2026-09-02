import { describe, expect, it } from "vitest";
import { shouldLoadReviewToken } from "../../src/review/reviewSession";

describe("review session loading", () => {
  it("waits for settings and consumes each token once", () => {
    expect(shouldLoadReviewToken(false, "token", null)).toBe(false);
    expect(shouldLoadReviewToken(true, "token", null)).toBe(true);
    expect(shouldLoadReviewToken(true, "token", "token")).toBe(false);
    expect(shouldLoadReviewToken(true, null, null)).toBe(false);
  });
});
