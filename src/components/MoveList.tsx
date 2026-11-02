import { useEffect, useMemo, useRef } from "react";
import type { MoveReview } from "../analysis/analysisTypes";
import { groupMovesByNumber } from "../chess/fullMoveRows";
import { MoveBadge } from "./MoveBadge";
import { San, TimeCell } from "./MoveParts";

export function MoveList({ moves, selectedPly, onSelect, openingName }: { moves: MoveReview[]; selectedPly: number; onSelect: (ply: number) => void; openingName?: string }) {
  const rows = groupMovesByNumber(moves);
  const listRef = useRef<HTMLDivElement>(null);
  const maxSpent = useMemo(() => Math.max(0, ...moves.map((move) => move.spentSeconds ?? 0)), [moves]);
  const hasTimes = moves.some((move) => move.spentSeconds !== undefined);
  // Keep the selected step visible inside the list only. scrollIntoView would also scroll the whole page,
  // so the list container's own scrollTop is adjusted instead and the page stays where it is.
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>("button.move.selected");
    if (!list || !selected) return;
    const listBox = list.getBoundingClientRect();
    const box = selected.getBoundingClientRect();
    if (box.top < listBox.top) list.scrollTop -= listBox.top - box.top + 4;
    else if (box.bottom > listBox.bottom) list.scrollTop += box.bottom - listBox.bottom + 4;
  }, [selectedPly]);
  const cell = (move?: MoveReview) => <div className="deep-move-cell" role="cell">{move ? <button className={selectedPly === move.ply ? "move selected" : "move"} onClick={() => onSelect(move.ply)} aria-label={`Nước ${move.moveNumber} ${move.color === "white" ? "Trắng" : "Đen"}, ${move.san}, ${move.primaryClassification}`} aria-pressed={selectedPly === move.ply}>
    <span className="san"><San san={move.san}/></span><MoveBadge classification={move.primaryClassification} tags={move.tags} compact/>
  </button> : null}</div>;
  return <div className="move-list-wrap">
    {openingName && <div className="opening-name" title="Khai cuộc">{openingName}</div>}
    <button className={selectedPly === 0 ? "move-start selected" : "move-start"} onClick={() => onSelect(0)} aria-pressed={selectedPly === 0}>Vị trí ban đầu</button>
    <div className={hasTimes ? "move-list with-times" : "move-list"} role="table" aria-label="Các nước đã phân tích" ref={listRef}>
      <div className="deep-move-header" role="row"><b>#</b><b>Trắng</b><b>Đen</b>{hasTimes && <b className="time-head">Thời gian</b>}</div>
      {rows.map((row) => <div className="deep-move-row" role="row" key={row.moveNumber}>
        <span className="move-number" role="rowheader">{row.moveNumber}</span>{cell(row.white)}{cell(row.black)}
        {hasTimes && <TimeCell white={row.white?.spentSeconds} black={row.black?.spentSeconds} max={maxSpent}/>}
      </div>)}
    </div>
  </div>;
}
