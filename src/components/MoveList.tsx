import type { MoveReview } from "../analysis/analysisTypes";
import { MoveBadge } from "./MoveBadge";
export function MoveList({ moves, selectedPly, onSelect }: { moves: MoveReview[]; selectedPly: number; onSelect: (ply: number) => void }) {
  return <div className="move-list" aria-label="Analyzed moves">{moves.map((move) => <button key={move.ply} className={selectedPly === move.ply ? "move selected" : "move"} onClick={() => onSelect(move.ply)} aria-label={`Move ${move.moveNumber}${move.color === "black" ? " black" : " white"}, ${move.san}, ${move.primaryClassification}`}>
    <span className="move-number">{move.color === "white" ? `${move.moveNumber}.` : `${move.moveNumber}...`}</span><strong>{move.san}</strong><MoveBadge classification={move.primaryClassification}/>
  </button>)}</div>;
}
