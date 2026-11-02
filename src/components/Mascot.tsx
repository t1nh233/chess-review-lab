import { useId } from "react";

export type MascotMood = "happy" | "think" | "sleepy" | "sad" | "cheer" | "mini";

const LABEL: Record<MascotMood, string> = { happy: "Tốt đang vui", think: "Tốt đang suy nghĩ", sleepy: "Tốt buồn ngủ", sad: "Tốt buồn", cheer: "Tốt reo mừng", mini: "Tốt" };
const INK = "#5B4636";

function Face({ mood }: { mood: Exclude<MascotMood, "mini"> }) {
  if (mood === "think") return <>
    <circle cx="42.5" cy="32" r="2.7" fill={INK} stroke="none"/><circle cx="60.5" cy="32" r="2.7" fill={INK} stroke="none"/>
    <circle cx="43.4" cy="31" r=".9" fill="#FFFDF4" stroke="none"/><circle cx="61.4" cy="31" r=".9" fill="#FFFDF4" stroke="none"/>
    <path d="M56 26.5 q4 -2.5 8 0"/><path d="M46 42.5 q4 -2 8 0"/>
    <circle cx="66.5" cy="26" r="2.4" fill="#FFFDF4"/><circle cx="71" cy="21" r="3.2" fill="#FFFDF4"/>
    <ellipse cx="83" cy="13" rx="15" ry="10" fill="#FFFDF4"/>
    <circle cx="76" cy="13" r="1.7" fill={INK} stroke="none"/><circle cx="83" cy="13" r="1.7" fill={INK} stroke="none"/><circle cx="90" cy="13" r="1.7" fill={INK} stroke="none"/>
  </>;
  if (mood === "sleepy") return <>
    <path d="M37.5 32 q3.5 4 7 0"/><path d="M55.5 32 q3.5 4 7 0"/>
    <ellipse cx="50" cy="42.5" rx="2.4" ry="3" fill="#B5523F"/>
    <path d="M74 14 h9 l-9 10 h9" strokeWidth="2.6"/><path d="M87 4 h6 l-6 7 h6" strokeWidth="2.2"/>
  </>;
  if (mood === "sad") return <>
    <circle cx="42" cy="34" r="2.7" fill={INK} stroke="none"/><circle cx="60" cy="34" r="2.7" fill={INK} stroke="none"/>
    <circle cx="42.9" cy="33" r=".9" fill="#FFFDF4" stroke="none"/><circle cx="60.9" cy="33" r=".9" fill="#FFFDF4" stroke="none"/>
    <path d="M36.5 27.5 L45 29.5"/><path d="M63.5 27.5 L55 29.5"/>
    <path d="M45 44 Q50 39 55 44"/>
    <path d="M38 38.5 q-2.8 4 0 5.6 q2.8 -1.6 0 -5.6Z" fill="#A9D4E0" stroke="#3E7C94" strokeWidth="1.2"/>
  </>;
  if (mood === "cheer") return <>
    <path d="M37 33.5 q4 -6.5 8 0"/><path d="M55 33.5 q4 -6.5 8 0"/>
    <path d="M43 39.5 Q50 51 57 39.5 Z" fill="#B5523F"/>
    <path d="M46.5 45.5 Q50 43 53.5 45.5 Q50 49 46.5 45.5Z" fill="#F2A7A0" stroke="none"/>
    <g fill="#E8A15B" strokeWidth="1" stroke={INK}>
      <path d="M14 15 Q14 22 21 22 Q14 22 14 29 Q14 22 7 22 Q14 22 14 15Z"/>
      <path d="M88 19 Q88 26 95 26 Q88 26 88 33 Q88 26 81 26 Q88 26 88 19Z"/>
      <path d="M10 53 Q10 60 17 60 Q10 60 10 67 Q10 60 3 60 Q10 60 10 53Z"/>
      <path d="M91 51 Q91 58 98 58 Q91 58 91 65 Q91 58 84 58 Q91 58 91 51Z"/>
    </g>
  </>;
  return <>
    <path d="M37.5 33 q3.5 -5 7 0"/><path d="M55.5 33 q3.5 -5 7 0"/>
    <path d="M45 40.5 Q50 47 55 40.5 Z" fill="#B5523F"/>
  </>;
}

/** "Tốt", the hand-drawn pawn mascot (watercolour look, wobbly outline, green scarf). Decorative unless `label` is set. */
export function Mascot({ mood = "happy", size = 56, label }: { mood?: MascotMood; size?: number; label?: boolean }) {
  const filterId = `wob${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const a11y = label ? { role: "img", "aria-label": LABEL[mood] } : { "aria-hidden": true as const };
  const tilt = mood === "sleepy" ? -7 : 0;
  return <svg className={`mascot mascot-${mood}`} viewBox="0 0 100 100" width={size} height={size} style={{ width: size, height: size, display: "block", overflow: "visible" }} focusable="false" {...a11y}>
    <defs><filter id={filterId} x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter></defs>
    {mood === "mini"
      ? <g stroke={INK} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
        <rect x="12" y="80" width="76" height="14" rx="7" fill="#F7E8C4"/>
        <path d="M33 56 C31 70 25 78 16 82 L84 82 C75 78 69 70 67 56 Z" fill="#F7E8C4"/>
        <ellipse cx="50" cy="56" rx="21" ry="7" fill="#6FA85A"/>
        <circle cx="50" cy="34" r="27" fill="#F7E8C4"/>
        <circle cx="40" cy="32" r="3.2" fill={INK} stroke="none"/><circle cx="60" cy="32" r="3.2" fill={INK} stroke="none"/>
        <path d="M42 43 Q50 50 58 43" fill="none" strokeWidth="4.5"/>
        <circle cx="30" cy="42" r="4.5" fill="#F2A7A0" stroke="none"/><circle cx="70" cy="42" r="4.5" fill="#F2A7A0" stroke="none"/>
      </g>
      : <>
        <g transform={`rotate(${tilt} 50 90)`} filter={`url(#${filterId})`} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <rect x="16" y="85" width="68" height="10" rx="5" fill="#EAD7A8"/>
          <path d="M35 54 C33 72 28 80 20 86 L80 86 C72 80 67 72 65 54 Z" fill="#F7E8C4"/>
          <path d="M58 57 C60 72 65 80 73 85 L66 85 C62 78 58 72 56 57Z" fill="#E6CF9C" stroke="none" opacity=".6"/>
          <ellipse cx="50" cy="54" rx="18" ry="5.5" fill="#6FA85A"/>
          <circle cx="50" cy="33" r="20" fill="#F7E8C4"/>
          <path d="M64 19 A20 20 0 0 1 58 52 A15 18 0 0 0 64 19 Z" fill="#E6CF9C" stroke="none" opacity=".55"/>
          <ellipse cx="40" cy="22" rx="6" ry="3.4" transform="rotate(-25 40 22)" fill="#FFFFFF" stroke="none" opacity=".6"/>
        </g>
        <g transform={`rotate(${tilt} 50 90)`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="34.5" cy="39.5" r="4" fill="#F2A7A0" stroke="none" opacity=".85"/>
          <circle cx="65.5" cy="39.5" r="4" fill="#F2A7A0" stroke="none" opacity=".85"/>
          <Face mood={mood}/>
        </g>
      </>}
  </svg>;
}
