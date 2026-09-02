import type { NormalizedEval } from "../engine/engineTypes";
function label(value: NormalizedEval): string { if (value.mate !== undefined) return `M${Math.abs(value.mate)}`; return `${((value.cp ?? 0) / 100).toFixed(1)}`; }
export function EvalBar({ evaluation }: { evaluation: NormalizedEval }) {
  const cp = evaluation.mate !== undefined ? Math.sign(evaluation.mate) * 1000 : evaluation.cp ?? 0;
  const white = 100 / (1 + Math.exp(-cp / 260));
  return <div className="eval-bar" aria-label={`Evaluation ${label(evaluation)}`}><div className="eval-black" style={{ height: `${100 - white}%` }}><span>{cp <= 0 ? label(evaluation) : ""}</span></div><div className="eval-white"><span>{cp > 0 ? label(evaluation) : ""}</span></div></div>;
}
