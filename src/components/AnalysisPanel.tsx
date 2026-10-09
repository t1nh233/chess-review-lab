import { describeMove, formatEval } from "../analysis/commentary";
import type { MoveReview } from "../analysis/analysisTypes";
import { toDisplayClassification } from "../popup/displayClassification";
import { DISPLAY_CLASSIFICATION_META } from "../presentation/displayClassification";
import { ClassificationIcon } from "../presentation/classificationIcons";

const showEval = formatEval;

export function AnalysisPanel({ move }: { move?: MoveReview }) {
  if (!move) return <section className="analysis-panel empty-state"><h2>Starting position</h2><p>Select a move, or press → to step through the game.</p></section>;
  const display = toDisplayClassification(move);
  const meta = DISPLAY_CLASSIFICATION_META[display];
  const commentary = describeMove(move);
  return <section className={`analysis-panel coach coach-${display}`}>
    <div className="coach-card">
      <ClassificationIcon classification={display}/>
      <div>
        <div className="coach-title"><span>{move.moveNumber}{move.color === "black" ? "..." : "."}</span><h2>{move.san}</h2><em>{meta.label}</em></div>
        <p>{commentary.headline}{commentary.detail ? ` ${commentary.detail}` : ""}</p>
        {commentary.advice && <p className="coach-best">{commentary.advice.text}</p>}
      </div>
      <span className="coach-eval">{showEval(move.evalAfter)}</span>
    </div>
    <details className="move-details"><summary>Chi tiết engine</summary>
      <dl className="metrics"><div><dt>Evaluation</dt><dd>{showEval(move.evalBefore)} → {showEval(move.evalAfter)}</dd></div><div><dt>Expected points</dt><dd>{move.expectedPointsBefore.toFixed(3)} → {move.expectedPointsAfter.toFixed(3)}</dd></div><div><dt>EP loss</dt><dd>{move.expectedPointsLoss.toFixed(3)}</dd></div><div><dt>Estimated accuracy</dt><dd>{move.estimatedAccuracy.toFixed(1)}</dd></div><div><dt>Depth</dt><dd>{move.analysisDepth}</dd></div><div><dt>Criticality</dt><dd>{Math.round(move.criticality * 100)}%</dd></div></dl>
      <div className="pv"><span>Engine continuations</span>{move.continuationLines.length > 1 ? move.continuationLines.map((line) => <code key={line.multipv}>#{line.multipv} {line.moves.slice(0, 8).join(" ")}</code>) : <><code>{move.principalVariation.slice(0, 8).join(" ") || "Unavailable"}</code>{move.continuationsStatus === "loading" && <small>Loading continuations...</small>}</>}</div>
      {move.tags.length > 0 && <div className="tags">{move.tags.map((tag) => <span key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>}
    </details>
  </section>;
}
