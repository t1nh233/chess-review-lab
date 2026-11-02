import { DISPLAY_CLASSIFICATION_META, type DisplayClassification } from "./displayClassification";

const CREAM = "#FFFDF4";

/** Hand-drawn move symbols: every category has its own silhouette, so colour is never the only cue. */
function Glyph({ classification }: { classification: DisplayClassification }) {
  switch (classification) {
    case "brilliant": return <>
      <path d="M12 2.5 L21.5 12 L12 21.5 L2.5 12 Z" fill="#1F8A8A"/>
      <g fill={CREAM} stroke="none"><rect x="9.2" y="6.8" width="1.8" height="6.2" rx=".9"/><rect x="13" y="6.8" width="1.8" height="6.2" rx=".9"/><circle cx="10.1" cy="16" r="1.1"/><circle cx="13.9" cy="16" r="1.1"/></g>
    </>;
    case "great": return <>
      <circle cx="12" cy="12" r="9.5" fill="#3E7C94"/>
      <g fill={CREAM} stroke="none"><rect x="11.1" y="6.2" width="1.8" height="7.4" rx=".9"/><circle cx="12" cy="16.9" r="1.2"/></g>
    </>;
    case "book": return <>
      <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#8A6A4A"/>
      <g fill="none" stroke={CREAM} strokeWidth="1.4"><path d="M12 8.8 Q9.4 7.4 6.6 8.2 V16.6 Q9.4 15.8 12 17.2 Z"/><path d="M12 8.8 Q14.6 7.4 17.4 8.2 V16.6 Q14.6 15.8 12 17.2 Z"/></g>
    </>;
    case "best": return <>
      <path d="M12 2.4 L14.6 8.6 L21.4 9.1 L16.2 13.5 L17.9 20.1 L12 16.6 L6.1 20.1 L7.8 13.5 L2.6 9.1 L9.4 8.6 Z" fill="#3F7D3A"/>
      <path d="M12 7.2 L13.2 10.4 L16.4 10.7 L13.9 12.8 L14.7 16 L12 14.3 L9.3 16 L10.1 12.8 L7.6 10.7 L10.8 10.4 Z" fill={CREAM} stroke="none"/>
    </>;
    case "excellent": return <>
      <path d="M4 20 C3 10 10 3 21 3 C21 14 15 21 4 20 Z" fill="#7FB05A"/>
      <path d="M5.5 18.5 L15 9" fill="none" stroke="#2F5D3A" strokeWidth="1.6"/>
    </>;
    case "good": return <>
      <path d="M7.5 19 A4.2 4.2 0 0 1 7.2 10.7 A5.6 5.6 0 0 1 17.8 9.6 A4.7 4.7 0 0 1 17 19 Z" fill="#A9D4E0"/>
      <path d="M8.8 14.4 L11.2 16.8 L15.6 11.6" fill="none" stroke="#2B5566" strokeWidth="2"/>
    </>;
    case "inaccuracy": return <>
      <path d="M12 2.5 L20.2 7.2 V16.8 L12 21.5 L3.8 16.8 V7.2 Z" fill="#F0B968"/>
      <path d="M7.2 9.6 a2 2 0 1 1 3.3 1.5 c-.6 .4 -.8 .8 -.8 1.5" fill="none" stroke="#4A3220" strokeWidth="1.6"/>
      <g fill="#4A3220" stroke="none"><circle cx="9.7" cy="15.6" r=".95"/><rect x="14.4" y="7.6" width="1.7" height="5.4" rx=".85"/><circle cx="15.25" cy="15.6" r=".95"/></g>
    </>;
    case "mistake": return <>
      <path d="M12 3 L21.5 19.5 Q22 20.5 21 20.5 H3 Q2 20.5 2.5 19.5 Z" fill="#CF6B33"/>
      <path d="M10 12 a2 2 0 1 1 3.1 1.6 c-.6 .4 -.9 .8 -.9 1.4" fill="none" stroke={CREAM} strokeWidth="1.6"/>
      <circle cx="12.2" cy="17.4" r=".95" fill={CREAM} stroke="none"/>
    </>;
    case "miss": return <>
      <path d="M8.2 2.8 H15.8 L21.2 8.2 V15.8 L15.8 21.2 H8.2 L2.8 15.8 V8.2 Z" fill="#8A4F7D"/>
      <path d="M8.4 8.4 L15.6 15.6 M15.6 8.4 L8.4 15.6" fill="none" stroke={CREAM} strokeWidth="2.1"/>
    </>;
    case "blunder": return <>
      <path d="M12 1.5 L15.14 4.42 L19.42 4.58 L19.58 8.86 L22.5 12 L19.58 15.14 L19.42 19.42 L15.14 19.58 L12 22.5 L8.86 19.58 L4.58 19.42 L4.42 15.14 L1.5 12 L4.42 8.86 L4.58 4.58 L8.86 4.42 Z" fill="#9B2C2C"/>
      <g fill="none" stroke={CREAM} strokeWidth="1.5"><path d="M6.5 9.6 a1.8 1.8 0 1 1 2.9 1.4 c-.5 .4 -.7 .7 -.7 1.3"/><path d="M13.1 9.6 a1.8 1.8 0 1 1 2.9 1.4 c-.5 .4 -.7 .7 -.7 1.3"/></g>
      <g fill={CREAM} stroke="none"><circle cx="8.8" cy="15.2" r=".85"/><circle cx="15.4" cy="15.2" r=".85"/></g>
    </>;
  }
}

export function ClassificationIcon({ classification, accessibleLabel, className = "" }: {
  classification: DisplayClassification;
  accessibleLabel?: string;
  className?: string;
}) {
  const accessibility = accessibleLabel
    ? { role: "img", "aria-label": accessibleLabel }
    : { "aria-hidden": true as const };
  return <svg viewBox="0 0 24 24" className={`classification-icon classification-icon-${classification} ${className}`.trim()} focusable="false" {...accessibility}>
    <g style={{ stroke: "var(--icon-outline, #5B4636)" }} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"><Glyph classification={classification}/></g>
  </svg>;
}

export function DisplayClassificationBadge({ classification, compact = false }: { classification: DisplayClassification; compact?: boolean }) {
  const meta = DISPLAY_CLASSIFICATION_META[classification];
  return <span className={`display-classification display-classification-${classification}${compact ? " compact" : ""}`} aria-label={meta.label}>
    <ClassificationIcon classification={classification}/>{!compact && <span>{meta.label}</span>}
  </span>;
}
