export type ThemeMode = "system" | "light" | "dark";
export const THEME_MODES: readonly ThemeMode[] = ["dark", "light", "system"];
export const DEFAULT_THEME_MODE: ThemeMode = "dark";
const KEY = "theme-mode";

export const isThemeMode = (value: unknown): value is ThemeMode => typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

const prefersDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.dataset.theme = resolveTheme(mode, prefersDark());
  document.documentElement.dataset.themeMode = mode;
}

export async function getThemeMode(): Promise<ThemeMode> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return DEFAULT_THEME_MODE;
  try {
    const value = (await chrome.storage.local.get(KEY))[KEY];
    return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
  } catch { return DEFAULT_THEME_MODE; }
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  applyThemeMode(mode);
  if (typeof chrome !== "undefined" && chrome.storage?.local) await chrome.storage.local.set({ [KEY]: mode });
}

/** Applies the saved mode and keeps every open extension page (popup, review) and the OS preference in sync. */
export function initTheme(): void {
  applyThemeMode(DEFAULT_THEME_MODE);
  void getThemeMode().then(applyThemeMode);
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && isThemeMode(changes[KEY]?.newValue)) applyThemeMode(changes[KEY].newValue as ThemeMode); });
  }
  if (typeof matchMedia === "function") {
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (document.documentElement.dataset.themeMode === "system") applyThemeMode("system"); });
  }
}
