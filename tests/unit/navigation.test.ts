import { describe, expect, it } from "vitest";
import { initialReviewView } from "../../src/review/navigation";

describe("review navigation", () => {
  it.each([
    ["?view=previous", "previous"],
    ["?view=settings", "settings"],
    ["?view=games", "games"],
    ["?view=review", "import"],
    ["?import=1", "import"],
    ["?view=unexpected", "import"],
    ["", "import"],
  ] as const)("maps %s to %s", (search, expected) => {
    expect(initialReviewView(search)).toBe(expected);
  });
});
