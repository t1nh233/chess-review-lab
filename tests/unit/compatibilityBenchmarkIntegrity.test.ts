import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("compatibility benchmark integrity", () => {
  it("does not use an annotated reference label to select Great-move inference", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/compatibility-benchmark.cjs"), "utf8");
    expect(source).not.toMatch(/references\.get\(key\)\s*===\s*["']Great["']/);
    expect(source).toContain('if(prediction==="Best"');
  });
});
