import { describe, expect, it } from "vitest";
import { expectedPoints, moverExpectedPoints } from "../../src/analysis/expectedPoints";
describe("expectedPoints", () => {
  it("maps equality near 0.5", () => expect(expectedPoints({ cp: 0 })).toBeCloseTo(0.5, 5));
  it("is monotonic and bounded", () => { const values = [-10000,-500,-20,0,20,500,10000].map((cp) => expectedPoints({ cp })); expect(values.every((value) => value >= 0 && value <= 1)).toBe(true); expect(values).toEqual([...values].sort((a,b) => a-b)); });
  it("maps large advantages near boundaries", () => { expect(expectedPoints({ cp: 5000 })).toBeGreaterThan(.99); expect(expectedPoints({ cp: -5000 })).toBeLessThan(.01); });
  it("maps mate to decisive expected points", () => { expect(expectedPoints({ mate: 2 })).toBeGreaterThan(.999); expect(expectedPoints({ mate: -2 })).toBeLessThan(.001); });
  it("normalizes White-positive evaluation to the mover's perspective", () => {
    expect(moverExpectedPoints({ cp: 200 }, "white")).toBeGreaterThan(0.5);
    expect(moverExpectedPoints({ cp: 200 }, "black")).toBeLessThan(0.5);
    expect(moverExpectedPoints({ cp: -200 }, "white")).toBeLessThan(0.5);
    expect(moverExpectedPoints({ cp: -200 }, "black")).toBeGreaterThan(0.5);
  });
  it("normalizes mate scores to the mover's perspective", () => {
    expect(moverExpectedPoints({ mate: 2 }, "white")).toBeGreaterThan(0.999);
    expect(moverExpectedPoints({ mate: 2 }, "black")).toBeLessThan(0.001);
    expect(moverExpectedPoints({ mate: -2 }, "black")).toBeGreaterThan(0.999);
  });
});
