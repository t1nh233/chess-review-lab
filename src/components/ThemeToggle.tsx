import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { DEFAULT_THEME_MODE, getThemeMode, isThemeMode, setThemeMode, THEME_MODES, type ThemeMode } from "../theme/themeMode";

const META: Record<ThemeMode, { label: string; Icon: typeof Sun }> = {
  system: { label: "Theo hệ thống", Icon: Monitor },
  light: { label: "Giao diện sáng", Icon: Sun },
  dark: { label: "Giao diện tối", Icon: Moon },
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
  return <button className="theme-toggle" aria-label={`${label} (nhấn để đổi sang: ${META[next].label})`} title={label} onClick={() => { setMode(next); void setThemeMode(next); }}><Icon/></button>;
}
