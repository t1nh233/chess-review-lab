import { describe, expect, it } from "vitest";
import { keyboardSelectedPly } from "../../src/review/selection";

describe("Deep Review ply keyboard navigation", () => {
  it("moves White to Black to next White and reverses by exact ply", () => {
    expect(keyboardSelectedPly(21, "ArrowRight", 118)).toBe(22);
    expect(keyboardSelectedPly(22, "ArrowRight", 118)).toBe(23);
    expect(keyboardSelectedPly(23, "ArrowLeft", 118)).toBe(22);
    expect(keyboardSelectedPly(22, "ArrowLeft", 118)).toBe(21);
  });

  it("keeps Home and End on the starting position and final ply", () => {
    expect(keyboardSelectedPly(57, "Home", 118)).toBe(0);
    expect(keyboardSelectedPly(57, "End", 118)).toBe(118);
    expect(keyboardSelectedPly(118, "ArrowRight", 118)).toBe(118);
    expect(keyboardSelectedPly(0, "ArrowLeft", 118)).toBe(0);
  });
});
