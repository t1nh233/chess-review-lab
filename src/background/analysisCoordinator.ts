import type { GameSafetyState } from "../safety/liveGameGuard";
import { assertAnalysisAllowed } from "../safety/liveGameGuard";
import type { ReviewSummary } from "../popup/reviewSummary";

export interface AnalysisJob {
  analysisId: string;
  hostToken: string;
  fingerprint: string;
  pgn: string;
  safetyState: GameSafetyState;
  summary: ReviewSummary;
}

export class AnalysisCoordinator {
  private readonly jobs = new Map<string, AnalysisJob>();
  private readonly byFingerprint = new Map<string, string>();

  start(job: AnalysisJob): { job: AnalysisJob; created: boolean } {
    assertAnalysisAllowed(job.safetyState);
    const existingId = this.byFingerprint.get(job.fingerprint);
    const existing = existingId ? this.jobs.get(existingId) : undefined;
    if (existing && (existing.summary.status === "queued" || existing.summary.status === "analyzing" || existing.summary.status === "completed")) return { job: existing, created: false };
    this.jobs.set(job.analysisId, job); this.byFingerprint.set(job.fingerprint, job.analysisId);
    return { job, created: true };
  }

  get(analysisId: string): AnalysisJob | undefined { return this.jobs.get(analysisId); }
  current(): AnalysisJob | undefined { return [...this.jobs.values()].at(-1); }
  update(analysisId: string, hostToken: string, summary: ReviewSummary): boolean {
    const job = this.jobs.get(analysisId);
    if (!job || job.hostToken !== hostToken) return false;
    job.summary = summary; return true;
  }
  cancel(analysisId: string): boolean {
    const job = this.jobs.get(analysisId); if (!job) return false;
    job.summary = { ...job.summary, status: "cancelled" }; return true;
  }
}
