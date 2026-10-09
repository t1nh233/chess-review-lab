import type { CSSProperties } from "react";
import { DISPLAY_CLASSIFICATION_META, type DisplayClassification } from "./displayClassification";

export function ClassificationIcon({ classification, accessibleLabel, className = "" }: {
  classification: DisplayClassification;
  accessibleLabel?: string;
  className?: string;
}) {
  const meta = DISPLAY_CLASSIFICATION_META[classification];
  const accessibility = accessibleLabel
    ? { role: "img", "aria-label": accessibleLabel }
    : { "aria-hidden": true as const };
  return <svg viewBox="0 0 24 24" className={`classification-icon classification-icon-${classification} ${className}`.trim()}
    style={{ "--classification-color": meta.semanticColor } as CSSProperties} focusable="false" {...accessibility}>
    <rect x="1" y="1" width="22" height="22" rx="11"/>
    <text x="12" y="12.4" dominantBaseline="middle" textAnchor="middle">{meta.icon}</text>
  </svg>;
}

export function DisplayClassificationBadge({ classification, compact = false }: { classification: DisplayClassification; compact?: boolean }) {
  const meta = DISPLAY_CLASSIFICATION_META[classification];
  return <span className={`display-classification display-classification-${classification}${compact ? " compact" : ""}`} aria-label={meta.label}>
    <ClassificationIcon classification={classification}/>{!compact && <span>{meta.label}</span>}
  </span>;
}
