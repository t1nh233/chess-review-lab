import type { GameReview } from "../analysis/analysisTypes";
import { CLASS_LABELS } from "./classificationLabels";
import { ExportPgn } from "./ExportPgn";
export function GameSummary({ review, onSelect }: { review: GameReview; onSelect: (ply: number) => void }) {
  const moveButton = (ply: number) => {
    const move = review.moves[ply - 1];
    if (!move) return null;
    return <button key={ply} onClick={() => onSelect(ply)}>Move {move.moveNumber}{move.color === "black" ? "..." : "."}{move.san}</button>;
  };
  return <section className="summary">
    <h2>Game summary</h2>
    <ExportPgn review={review}/>
    <p>{review.summary.headline}</p>
    <div className="accuracy-pair"><div><strong>{review.whiteAccuracy.toFixed(1)}</strong><span>White estimated accuracy</span></div><div><strong>{review.blackAccuracy.toFixed(1)}</strong><span>Black estimated accuracy</span></div></div>
    <div className="summary-grid">{(["white", "black"] as const).map((color) => <div key={color}><h3>{color}</h3>{Object.entries(review.summary.counts[color]).filter(([, count]) => count > 0).map(([name, count]) => <div className="count-row" key={name}><span>{CLASS_LABELS[name as keyof typeof CLASS_LABELS]}</span><strong>{count}</strong></div>)}</div>)}</div>
    <h3>Largest mistake</h3>
    <div className="critical-links">{review.summary.largestMistakePly ? moveButton(review.summary.largestMistakePly) : <span>None identified</span>}</div>
    <h3>Critical moments</h3>
    <div className="critical-links">{review.summary.criticalPlies.map(moveButton)}</div>
    <h3>Special moves</h3>
    <div className="critical-links">{review.summary.specialPlies.length ? review.summary.specialPlies.map(moveButton) : <span>None identified</span>}</div>
  </section>;
}
