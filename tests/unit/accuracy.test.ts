import { describe, expect, it } from "vitest";
import { gameAccuracy, moveAccuracy } from "../../src/analysis/accuracy";
describe("accuracy", () => {
  it("gives zero loss 100", () => expect(moveAccuracy(0,.5).raw).toBeCloseTo(100));
  it("decreases monotonically", () => expect([0,.02,.1,.3].map((loss) => moveAccuracy(loss,.5).raw)).toEqual([...[0,.02,.1,.3].map((loss) => moveAccuracy(loss,.5).raw)].sort((a,b) => b-a)));
  it("keeps move and game accuracy bounded", () => {
    for (const loss of [-1, 0, 0.1, 1, 100]) expect(moveAccuracy(loss, 0.5).raw).toBeGreaterThanOrEqual(0);
    for (const loss of [-1, 0, 0.1, 1, 100]) expect(moveAccuracy(loss, 0.5).raw).toBeLessThanOrEqual(100);
    const result = gameAccuracy([{ estimatedAccuracy: 100, accuracyWeight: 1 }, { estimatedAccuracy: 5, accuracyWeight: 1.5 }]);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
  it("penalizes a Blunder more than a small Inaccuracy", () => {
    expect(moveAccuracy(0.25, 0.5).raw).toBeLessThan(moveAccuracy(0.06, 0.5).raw);
  });
  it("reduces the aggregate distortion of trivial forced moves", () => {
    const ordinary = moveAccuracy(0, 0.3, { forced: false });
    const forced = moveAccuracy(0, 0.3, { forced: true });
    expect(forced.raw).toBe(ordinary.raw);
    expect(forced.weight).toBeLessThan(ordinary.weight);
  });
  it("downweights harmless shuffling in already-decided positions", () => {
    const balanced = moveAccuracy(0, 0.2, { decidedness: 0 });
    const decided = moveAccuracy(0, 0.2, { decidedness: 0.95 });
    expect(decided.weight).toBeLessThan(balanced.weight);
  });
  it("applies a meaningful mate-transition penalty", () => {
    expect(moveAccuracy(0.02, 0.6, { mateLoss: true }).raw).toBeLessThan(moveAccuracy(0.02, 0.6).raw);
  });
  it("uses explainable error-sensitive aggregation rather than equal averaging", () => {
    const smallError = gameAccuracy([{ estimatedAccuracy: 95, accuracyWeight: 1 }, { estimatedAccuracy: 100, accuracyWeight: 1 }]);
    const blunder = gameAccuracy([{ estimatedAccuracy: 20, accuracyWeight: 1 }, { estimatedAccuracy: 100, accuracyWeight: 1 }]);
    expect(blunder).toBeLessThan(smallError);
  });
});
