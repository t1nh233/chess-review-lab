import { describe, expect, it } from "vitest";
import { lineEvaluationFromWhite } from "../../src/analysis/evaluation";
const line = (scoreCp?: number, mate?: number) => ({ multipv: 1, depth: 18, scoreCp, mate, moves: ["e2e4"] });
describe("evaluation normalization", () => {
  it("keeps a white-to-move cp score", () => expect(lineEvaluationFromWhite(line(120), "8/8/8/8/8/8/8/8 w - - 0 1")).toEqual({ cp: 120 }));
  it("negates a black-to-move cp score", () => expect(lineEvaluationFromWhite(line(120), "8/8/8/8/8/8/8/8 b - - 0 1")).toEqual({ cp: -120 }));
  it("normalizes mate for White", () => expect(lineEvaluationFromWhite(line(undefined, 3), "8/8/8/8/8/8/8/8 w - - 0 1")).toEqual({ mate: 3 }));
  it("normalizes mate for Black", () => expect(lineEvaluationFromWhite(line(undefined, 3), "8/8/8/8/8/8/8/8 b - - 0 1")).toEqual({ mate: -3 }));
});
