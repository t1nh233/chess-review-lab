import type { PointerEvent } from "react";
import type { MoveReview } from "../analysis/analysisTypes";
import { evalToCp } from "../analysis/evaluation";
import { toDisplayClassification } from "../popup/displayClassification";

const y = (move: MoveReview) => 50 - Math.tanh(evalToCp(move.evalAfter) / 500) * 46;
export function EvaluationChart({ moves, selectedPly, onSelect }: { moves: MoveReview[]; selectedPly: number; onSelect: (ply: number) => void }) {
  if (!moves.length) return <div className="chart-wrap"/>;
  const x = (i: number) => moves.length === 1 ? 50 : (i / (moves.length - 1)) * 100;
  const line = moves.map((move, i) => `${x(i)},${y(move)}`).join(" ");
  const area = `0,100 ${line} 100,100`;
  const select = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    onSelect(moves[Math.round(ratio * (moves.length - 1))].ply);
  };
  return <div className="chart-wrap"><svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Evaluation graph" onPointerDown={select} onPointerMove={(event) => { if (event.buttons === 1) select(event); }}>
    <polygon points={area} className="chart-area"/>
    <line x1="0" y1="50" x2="100" y2="50" className="chart-zero"/>
    <polyline points={line} className="chart-line"/>
    {selectedPly > 0 && <line x1={x(selectedPly - 1)} y1="0" x2={x(selectedPly - 1)} y2="100" className="chart-cursor"/>}
    {moves.map((move, i) => {
      const kind = toDisplayClassification(move);
      const notable = ["brilliant", "great", "inaccuracy", "mistake", "miss", "blunder"].includes(kind);
      return <circle key={move.ply} cx={x(i)} cy={y(move)} r={selectedPly === move.ply ? 2.6 : notable ? 1.7 : 0.9}
        className={`chart-point${selectedPly === move.ply ? " active" : ""}${notable ? ` notable notable-${kind}` : ""}`}
        role="button" tabIndex={0} aria-label={`Select move ${move.moveNumber}${move.color === "black" ? "..." : "."}${move.san}`}
        onClick={(event) => { event.stopPropagation(); onSelect(move.ply); }}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(move.ply); } }}/>;
    })}
  </svg></div>;
}
