import { describe, expect, it } from "vitest";
import { applyThemeMode, isThemeMode, resolveTheme } from "../../src/theme/themeMode";

describe("theme mode", () => {
  it("resolves system mode from the OS preference and honours explicit modes", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("validates stored values", () => {
    expect(["system", "light", "dark"].every(isThemeMode)).toBe(true);
    expect(isThemeMode("sepia")).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });
  it("applies the resolved theme to the document element", () => {
    applyThemeMode("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themeMode).toBe("dark");
    applyThemeMode("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
