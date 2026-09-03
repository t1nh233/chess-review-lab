import type { MoveReview } from "../analysis/analysisTypes";
import type { NormalizedEval } from "../engine/engineTypes";
import { MoveBadge } from "./MoveBadge";
const showEval = (value: NormalizedEval) => value.mate !== undefined ? `Mate ${value.mate > 0 ? "for White" : "for Black"} in ${Math.abs(value.mate)}` : `${((value.cp ?? 0) / 100).toFixed(2)}`;
export function AnalysisPanel({ move }: { move?: MoveReview }) {
  if (!move) return <section className="analysis-panel empty-state"><h2>Starting position</h2><p>Select a move to inspect its review.</p></section>;
  return <section className="analysis-panel"><div className="detail-heading"><div><span className="eyebrow">Move {move.moveNumber}{move.color === "black" ? "..." : "."}</span><h2>{move.san}</h2></div><MoveBadge classification={move.primaryClassification} tags={move.tags}/></div><p>{move.explanation}</p>
    <dl className="metrics"><div><dt>Best move</dt><dd>{move.bestMove ?? "Unavailable"}</dd></div><div><dt>Evaluation</dt><dd>{showEval(move.evalBefore)} → {showEval(move.evalAfter)}</dd></div><div><dt>Expected points</dt><dd>{move.expectedPointsBefore.toFixed(3)} → {move.expectedPointsAfter.toFixed(3)}</dd></div><div><dt>EP loss</dt><dd>{move.expectedPointsLoss.toFixed(3)}</dd></div><div><dt>Estimated accuracy</dt><dd>{move.estimatedAccuracy.toFixed(1)}</dd></div><div><dt>Criticality</dt><dd>{Math.round(move.criticality * 100)}%</dd></div></dl>
    <div className="pv"><span>Engine continuations</span>{move.continuationLines.length > 1 ? move.continuationLines.map((line) => <code key={line.multipv}>#{line.multipv} {line.moves.slice(0, 8).join(" ")}</code>) : <><code>{move.principalVariation.slice(0, 8).join(" ") || "Unavailable"}</code>{move.continuationsStatus === "loading" && <small>Loading continuations...</small>}</>}</div>{move.tags.length > 0 && <div className="tags">{move.tags.map((tag) => <span key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>}
  </section>;
}
