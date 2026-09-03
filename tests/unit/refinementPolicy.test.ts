import { describe, expect, it } from "vitest";
import { shouldRefinePosition, type RefinementEvidence } from "../../src/analysis/refinementPolicy";

const stable: RefinementEvidence = {
  expectedPointsLoss: 0.32,
  criticality: 0.2,
  bestMoveChanged: false,
  evaluationRangeCp: 20,
  mateStatusChanged: false,
  greatCandidate: false,
  brilliantCandidate: false,
  missCandidate: false,
  onlyMoveCandidate: false,
  multiPvRequired: false,
};

describe("selective refinement policy", () => {
  it("stops a stable position far from a classification boundary at base depth", () => {
    expect(shouldRefinePosition(stable)).toEqual({ refine: false, level: "base", reasons: ["stable_far_from_boundary"] });
  });

  it("refines a boundary-near position to maximum depth", () => {
    expect(shouldRefinePosition({ ...stable, expectedPointsLoss: 0.051 })).toMatchObject({ refine: true, level: "maximum", reasons: ["classification_boundary"] });
  });

  it("refines when the best move changes during meaningful depth updates", () => {
    expect(shouldRefinePosition({ ...stable, bestMoveChanged: true })).toMatchObject({ refine: true, level: "maximum" });
  });

  it("gives a Great candidate required intermediate-depth evidence", () => {
    expect(shouldRefinePosition({ ...stable, greatCandidate: true, multiPvRequired: true })).toMatchObject({ refine: true, level: "intermediate" });
  });

  it("uses intermediate depth for moderate evaluation instability", () => {
    expect(shouldRefinePosition({ ...stable, evaluationRangeCp: 90 })).toMatchObject({ refine: true, level: "intermediate" });
  });
});
