import { useEffect, useState } from "react";
import { vi } from "../i18n/vi";
import { Monitor, Moon, Sun } from "lucide-react";
import { DEFAULT_THEME_MODE, getThemeMode, isThemeMode, setThemeMode, THEME_MODES, type ThemeMode } from "../theme/themeMode";

const META: Record<ThemeMode, { label: string; Icon: typeof Sun }> = {
  system: { label: vi.theme.system, Icon: Monitor },
  light: { label: vi.theme.light, Icon: Sun },
  dark: { label: vi.theme.dark, Icon: Moon },
};

/** Cycles dark -> light -> system. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  useEffect(() => {
    void getThemeMode().then(setMode);
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const next = changes["theme-mode"]?.newValue;
      if (area === "local" && isThemeMode(next)) setMode(next);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);
  const { label, Icon } = META[mode];
  const next = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
  return <button className="theme-toggle" aria-label={`${label} (${vi.theme.switchTo}: ${META[next].label})`} title={label} onClick={() => { setMode(next); void setThemeMode(next); }}><Icon/></button>;
}
