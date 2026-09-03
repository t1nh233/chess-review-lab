import type { GameReview } from "../analysis/analysisTypes";
import { toDisplayClassification } from "../popup/displayClassification";
import { ClassificationSummary } from "./ClassificationSummary";
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
    <ClassificationSummary
      whiteName={review.game.headers.White ?? "White"}
      blackName={review.game.headers.Black ?? "Black"}
      whiteAccuracy={review.whiteAccuracy}
      blackAccuracy={review.blackAccuracy}
      moves={review.moves.map((move) => ({ color: move.color, displayClassification: toDisplayClassification(move) }))}
    />
    <h3>Largest mistake</h3>
    <div className="critical-links">{review.summary.largestMistakePly ? moveButton(review.summary.largestMistakePly) : <span>None identified</span>}</div>
    <h3>Critical moments</h3>
    <div className="critical-links">{review.summary.criticalPlies.map(moveButton)}</div>
    <h3>Special moves</h3>
    <div className="critical-links">{review.summary.specialPlies.length ? review.summary.specialPlies.map(moveButton) : <span>None identified</span>}</div>
  </section>;
}
