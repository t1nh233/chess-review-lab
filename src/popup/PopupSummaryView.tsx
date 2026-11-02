import { ClassificationSummary } from "../components/ClassificationSummary";
import { Mascot } from "../components/Mascot";
import { vi } from "../i18n/vi";
import type { ReviewSummary } from "./reviewSummary";

interface Props { summary: ReviewSummary; onCancel: () => void; onExit: () => void; onDeep: (analysisId: string) => void; deepLabel?: string }

function stepIndex(phase: ReviewSummary["phase"]): number {
  if (phase === "refinement" || phase === "multiPvExpansion") return 1;
  return phase === "finalizing" ? 2 : 0;
}

const Check = () => <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 l4.5 4.5 L19 7.5"/></svg>;
const Leaf = () => <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 20 C3 10 10 3 21 3 C21 14 15 21 4 20Z"/></svg>;

export function PopupSummaryView({ summary, onCancel, onExit, onDeep, deepLabel = vi.result.open }: Props) {
  const players = <p className="popup-players">{summary.whiteName} <small>vs</small> {summary.blackName}</p>;
  if (summary.status === "queued" || summary.status === "analyzing") {
    const phaseLabel = summary.phase === "refinement" || summary.phase === "multiPvExpansion" ? vi.progress.refinement : summary.phase === "finalizing" ? vi.progress.finalizing : vi.progress.quick;
    const value = summary.phaseCompleted ?? summary.currentPly;
    const max = Math.max(1, summary.phaseTotal ?? summary.totalPlies);
    const active = stepIndex(summary.phase);
    const percent = Math.min(100, Math.round((value / max) * 100));
    return <main className="popup-summary" aria-label={vi.progress.region}>
      <div className="card hero"><Mascot mood="think" size={64}/><div><h1>{vi.progress.title}</h1>{players}</div></div>
      <div className="card card-col">
        <ol className="steps">{vi.progress.steps.map((label, index) => {
          const state = index < active ? "done" : index === active ? "now" : "todo";
          return <li key={label} className={`step step-${state}`}>
            <span className={`dot dot-${state}`}>{state === "done" ? <Check/> : state === "now" ? <Leaf/> : null}</span>
            <span className="step-name">{label}</span><span className="step-state">{vi.progress.stepState[state]}</span>
          </li>;
        })}</ol>
        <strong className="phase-label">{phaseLabel}{summary.phase !== "finalizing" ? ` ${value} / ${max}` : ""}</strong>
        <progress value={value} max={max} aria-label={phaseLabel}/>
        <span className="percent">{percent}%</span>
      </div>
      <p className="popup-hint">{vi.progress.tip}</p>
      <small className="tech-line">{vi.progress.tech(summary.currentDepth)}</small>
      <div className="popup-actions">
        <button className="secondary" onClick={onCancel}>{vi.progress.cancel}</button>
        <button className="exit-action" onClick={onExit}>{vi.progress.stopAndExit}</button>
      </div>
    </main>;
  }
  if (summary.status === "completed") return <main className="popup-summary completed-summary">
    <div className="card hero"><Mascot mood="cheer" size={64}/><div><h1>{vi.result.doneTitle}</h1>{players}</div></div>
    <ClassificationSummary whiteName={summary.whiteName} blackName={summary.blackName} whiteAccuracy={summary.whiteAccuracy} blackAccuracy={summary.blackAccuracy} moves={summary.moves}/>
    <p className="popup-hint">{vi.result.hint}</p>
    <div className="popup-actions popup-actions-completed">
      <button className="primary" onClick={() => onDeep(summary.analysisId)}>{deepLabel}</button>
      <button className="secondary" onClick={onExit}>{vi.result.next}</button>
    </div>
  </main>;
  const cancelled = summary.status === "cancelled";
  return <main className="popup-summary">
    <div className="card hero"><Mascot mood={cancelled ? "sleepy" : "sad"} size={64}/><div><h1>{cancelled ? vi.result.cancelledTitle : vi.result.failedTitle}</h1><p className="popup-players">{cancelled ? vi.result.cancelledBody : summary.error ?? vi.result.failedBody}</p></div></div>
    <button className="secondary wide" onClick={onExit}>{vi.result.next}</button>
  </main>;
}
