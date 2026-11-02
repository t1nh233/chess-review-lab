import type { ReactNode } from "react";
import type { GameReview } from "../analysis/analysisTypes";
import { toDisplayClassification } from "../popup/displayClassification";
import { ClassificationSummary } from "./ClassificationSummary";
import { ExportPgn } from "./ExportPgn";
export function GameSummary({ review, onSelect, children }: { review: GameReview; onSelect: (ply: number) => void; children?: ReactNode }) {
  const moveButton = (ply: number) => {
    const move = review.moves[ply - 1];
    if (!move) return null;
    return <button key={ply} onClick={() => onSelect(ply)}>Nước {move.moveNumber}{move.color === "black" ? "..." : "."}{move.san}</button>;
  };
  return <section className="summary">
    <h2>Tóm tắt ván đấu</h2>
    <ExportPgn review={review}/>
    <p>{review.summary.headline}</p>
    <ClassificationSummary
      whiteName={review.game.headers.White ?? "Trắng"}
      blackName={review.game.headers.Black ?? "Đen"}
      whiteAccuracy={review.whiteAccuracy}
      blackAccuracy={review.blackAccuracy}
      moves={review.moves.map((move) => ({ color: move.color, displayClassification: toDisplayClassification(move) }))}
    />
    {children && <div className="summary-moves">{children}</div>}
    <h3>Sai lầm lớn nhất</h3>
    <div className="critical-links">{review.summary.largestMistakePly ? moveButton(review.summary.largestMistakePly) : <span>Không có</span>}</div>
    <h3>Thời khắc quyết định</h3>
    <div className="critical-links">{review.summary.criticalPlies.map(moveButton)}</div>
    <h3>Nước đi đặc biệt</h3>
    <div className="critical-links">{review.summary.specialPlies.length ? review.summary.specialPlies.map(moveButton) : <span>Không có</span>}</div>
  </section>;
}
