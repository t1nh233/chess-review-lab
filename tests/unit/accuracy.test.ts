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
});
