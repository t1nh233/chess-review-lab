import type { NormalizedEval } from "../engine/engineTypes";
function label(value: NormalizedEval): string { if (value.mate !== undefined) return `M${Math.abs(value.mate)}`; return `${Math.abs((value.cp ?? 0) / 100).toFixed(1)}`; }
export function EvalBar({ evaluation, orientation = "white" }: { evaluation: NormalizedEval; orientation?: "white" | "black" }) {
  const cp = evaluation.mate !== undefined ? Math.sign(evaluation.mate) * 1000 : evaluation.cp ?? 0;
  const white = Math.min(98, Math.max(2, 100 / (1 + Math.exp(-cp / 260))));
  const whiteWinning = cp >= 0;
  return <div className={`eval-bar eval-bar-${orientation}`} aria-label={`Evaluation ${cp > 0 ? "+" : cp < 0 ? "-" : ""}${label(evaluation)}`}>
    <div className="eval-black" style={{ height: `${100 - white}%` }}>{!whiteWinning && <span>{label(evaluation)}</span>}</div>
    <div className="eval-white">{whiteWinning && <span>{label(evaluation)}</span>}</div>
  </div>;
}
