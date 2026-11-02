import type { Settings } from "../storage/settings";
import { vi } from "../i18n/vi";

type SelectProps<K extends keyof Settings> = { id: string; label: string; hint?: string; value: Settings[K]; options: Record<string, string>; onChange: (value: Settings[K]) => void };

function SelectField<K extends keyof Settings>({ id, label, hint, value, options, onChange }: SelectProps<K>) {
  return <div className="setting-row">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={String(value)} onChange={(event) => onChange(event.target.value as Settings[K])}>
      {Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
    {hint && <small>{hint}</small>}
  </div>;
}

function ToggleField({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="setting-row toggle-row">
    <input id={id} type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)}/>
    <label htmlFor={id}>{label}{hint && <small>{hint}</small>}</label>
  </div>;
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const t = vi.settings;
  return <section className="settings-panel">
    <h2>{t.title}</h2>
    <SelectField<"analysisQuality"> id="set-quality" label={t.quality} hint={t.qualityHint} value={settings.analysisQuality} options={t.qualityOptions} onChange={(value) => update("analysisQuality", value)}/>
    <SelectField<"boardOrientation"> id="set-orientation" label={t.orientation} value={settings.boardOrientation} options={t.orientationOptions} onChange={(value) => update("boardOrientation", value)}/>
    <ToggleField id="set-arrow" label={t.arrow} checked={settings.showBestMoveArrow} onChange={(value) => update("showBestMoveArrow", value)}/>
    <ToggleField id="set-cache" label={t.cache} hint={t.cacheHint} checked={settings.cachePreviousReviews} onChange={(value) => update("cachePreviousReviews", value)}/>
    <ToggleField id="set-compat" label={t.compat} hint={t.compatHint} checked={settings.compatibilityClassifier} onChange={(value) => update("compatibilityClassifier", value)}/>
  </section>;
}
