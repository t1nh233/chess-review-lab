import { describe, expect, it } from "vitest";
import { groupMovesByNumber } from "../../src/chess/fullMoveRows";

describe("full-move grouping", () => {
  it("places White and Black plies for the same move number on one row", () => {
    const white = { ply: 21, moveNumber: 11, color: "white" as const, san: "Bxe7" };
    const black = { ply: 22, moveNumber: 11, color: "black" as const, san: "Bxe7" };
    expect(groupMovesByNumber([white, black])).toEqual([{ moveNumber: 11, white, black }]);
  });

  it("supports an incomplete final row", () => {
    expect(groupMovesByNumber([{ ply: 1, moveNumber: 1, color: "white" as const }])).toEqual([
      { moveNumber: 1, white: { ply: 1, moveNumber: 1, color: "white" } },
    ]);
  });
});
