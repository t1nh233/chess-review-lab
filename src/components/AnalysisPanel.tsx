import { describeMove, formatEval } from "../analysis/commentary";
import type { MoveReview } from "../analysis/analysisTypes";
import { toDisplayClassification } from "../popup/displayClassification";
import { DISPLAY_CLASSIFICATION_META, type DisplayClassification } from "../presentation/displayClassification";
import { ClassificationIcon } from "../presentation/classificationIcons";
import { Mascot, type MascotMood } from "./Mascot";

const showEval = formatEval;
const COACH_MOOD: Record<DisplayClassification, MascotMood> = { brilliant: "cheer", great: "cheer", book: "happy", best: "happy", excellent: "happy", good: "happy", inaccuracy: "think", mistake: "sad", miss: "sad", blunder: "sad" };

export function AnalysisPanel({ move }: { move?: MoveReview }) {
  if (!move) return <section className="analysis-panel empty-state"><Mascot mood="happy" size={64}/><h2>Vị trí ban đầu</h2><p>Chọn một nước đi hoặc nhấn phím → để xem lần lượt từng nước nhé.</p></section>;
  const display = toDisplayClassification(move);
  const meta = DISPLAY_CLASSIFICATION_META[display];
  const commentary = describeMove(move);
  return <section className={`analysis-panel coach coach-${display}`}>
    <div className="coach-card">
      <Mascot mood={COACH_MOOD[display]} size={60}/>
      <div>
        <div className="coach-title"><ClassificationIcon classification={display}/><span>{move.moveNumber}{move.color === "black" ? "..." : "."}</span><h2>{move.san}</h2><em>{meta.label}</em></div>
        <p>{commentary.headline}{commentary.detail ? ` ${commentary.detail}` : ""}</p>
        {commentary.advice && <p className="coach-best">{commentary.advice.text}</p>}
      </div>
      <span className="coach-eval">{showEval(move.evalAfter)}</span>
    </div>
    <details className="move-details"><summary>Chi tiết engine</summary>
      <dl className="metrics"><div><dt>Đánh giá</dt><dd>{showEval(move.evalBefore)} → {showEval(move.evalAfter)}</dd></div><div><dt>Điểm kỳ vọng</dt><dd>{move.expectedPointsBefore.toFixed(3)} → {move.expectedPointsAfter.toFixed(3)}</dd></div><div><dt>Điểm kỳ vọng mất đi</dt><dd>{move.expectedPointsLoss.toFixed(3)}</dd></div><div><dt>Độ chính xác ước tính</dt><dd>{move.estimatedAccuracy.toFixed(1)}</dd></div><div><dt>Độ sâu</dt><dd>{move.analysisDepth}</dd></div><div><dt>Mức quan trọng</dt><dd>{Math.round(move.criticality * 100)}%</dd></div></dl>
      <div className="pv"><span>Biến chính của engine</span>{move.continuationLines.length > 1 ? move.continuationLines.map((line) => <code key={line.multipv}>#{line.multipv} {line.moves.slice(0, 8).join(" ")}</code>) : <><code>{move.principalVariation.slice(0, 8).join(" ") || "Chưa có"}</code>{move.continuationsStatus === "loading" && <small>Đang tải biến chính...</small>}</>}</div>
      {move.tags.length > 0 && <div className="tags">{move.tags.map((tag) => <span key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>}
    </details>
  </section>;
}
