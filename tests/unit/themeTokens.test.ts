import { describe, expect, it } from "vitest";
import { DISPLAY_CLASSIFICATIONS, DISPLAY_CLASSIFICATION_META } from "../../src/presentation/displayClassification";
import { SHARED_THEME_TOKENS, SOURCE_PALETTE } from "../../src/presentation/themeTokens";

describe("shared palette theme", () => {
  it("publishes the supplied source palette and reusable semantic tokens", () => {
    expect(SOURCE_PALETTE).toEqual({ primary: "#2A7C13", secondary: "#76C457", surface: "#FFF8CF", warmSurface: "#FBE6C2" });
    expect(SHARED_THEME_TOKENS).toEqual(["--background", "--panel", "--text", "--divider", "--selected", "--hover", "--focus"]);
  });

  it("resolves palette-backed style metadata for all ten display classifications", () => {
    expect(DISPLAY_CLASSIFICATIONS).toHaveLength(10);
    for (const classification of DISPLAY_CLASSIFICATIONS) {
      expect(DISPLAY_CLASSIFICATION_META[classification].semanticColor).toBe(`var(--classification-${classification})`);
    }
  });
});
