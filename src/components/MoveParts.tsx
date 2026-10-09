const FIGURINES = new Set(["K", "Q", "R", "B", "N"]);
const formatSeconds = (seconds: number) => seconds >= 60 ? `${Math.floor(seconds / 60)}m${String(Math.round(seconds % 60)).padStart(2, "0")}s` : `${seconds.toFixed(1)}s`;

/** SAN with the piece letter drawn as a figurine, as in Chess.com's move list. */
export function San({ san }: { san: string }) {
  const piece = san[0];
  return <>{FIGURINES.has(piece) && <img className="figurine" src={`pieces/w${piece}.svg`} alt="" draggable={false}/>}<strong>{FIGURINES.has(piece) ? san.slice(1) : san}</strong></>;
}

/** Time spent on one move: a bar scaled (square-root) against the slowest move of the game, plus its label. */
export function TimeBar({ seconds, max, color }: { seconds?: number; max: number; color: "white" | "black" }) {
  if (seconds === undefined) return <div className="time-line"/>;
  const width = max > 0 ? Math.max(4, Math.round(Math.sqrt(seconds / max) * 100)) : 4;
  return <div className="time-line"><span className="time-label">{formatSeconds(seconds)}</span><span className={`time-bar time-bar-${color}`} style={{ width: `${width}%` }}/></div>;
}

export function TimeCell({ white, black, max }: { white?: number; black?: number; max: number }) {
  return <div className="time-cell"><TimeBar seconds={white} max={max} color="white"/><TimeBar seconds={black} max={max} color="black"/></div>;
}
