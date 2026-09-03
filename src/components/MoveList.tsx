import type { MoveReview } from "../analysis/analysisTypes";
import { groupMovesByNumber } from "../chess/fullMoveRows";
import { MoveBadge } from "./MoveBadge";
export function MoveList({ moves, selectedPly, onSelect }: { moves: MoveReview[]; selectedPly: number; onSelect: (ply: number) => void }) {
  const rows = groupMovesByNumber(moves);
  const cell = (move?: MoveReview) => <div className="deep-move-cell" role="cell">{move ? <button className={selectedPly === move.ply ? "move selected" : "move"} onClick={() => onSelect(move.ply)} aria-label={`Move ${move.moveNumber} ${move.color}, ${move.san}, ${move.primaryClassification}`} aria-pressed={selectedPly === move.ply}>
    <strong>{move.san}</strong><MoveBadge classification={move.primaryClassification}/>
  </button> : null}</div>;
  return <div className="move-list" role="table" aria-label="Analyzed moves"><div className="deep-move-header" role="row"><b>#</b><b>White</b><b>Black</b></div>{rows.map((row) => <div className="deep-move-row" role="row" key={row.moveNumber}><span className="move-number" role="rowheader">{row.moveNumber}</span>{cell(row.white)}{cell(row.black)}</div>)}</div>;
}
