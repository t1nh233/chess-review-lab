import { isExtensionMessage } from "./messages";
import { AnalysisCoordinator, type AnalysisJob } from "./analysisCoordinator";
import { completedReviewSummary, createQueuedSummary } from "../popup/reviewSummary";
import { assertAnalysisAllowed, isAnalysisAllowed, isGameSafetyState, type GameSafetyState } from "../safety/liveGameGuard";
import { gameFingerprint, parsePgn } from "../chess/pgn";
import { ANALYSIS_MODEL_VERSION, CLASSIFIER_VERSION, ENGINE_VERSION, EXPECTED_POINTS_MODEL_VERSION } from "../config/versions";
import { findCachedReview } from "../storage/analysisCache";
import { getSettings } from "../storage/settings";
import { debugLog } from "../utils/logger";

export interface ReviewPayload { pgn: string; safetyState: GameSafetyState; createdAt: number }
export const REVIEW_PAYLOAD_TTL_MS = 30 * 60 * 1000;
const payloads = new Map<string, ReviewPayload>();
const coordinator = new AnalysisCoordinator();
const jobKey = (analysisId: string) => `analysis-job:${analysisId}`;
const activeKey = (fingerprint: string) => `analysis-active:${fingerprint}`;

export function isReviewPayloadActive(value: unknown, now = Date.now()): value is ReviewPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ReviewPayload>;
  return typeof payload.pgn === "string" && payload.pgn.trim().length > 0 && payload.pgn.length <= 2_000_000
    && isGameSafetyState(payload.safetyState) && isAnalysisAllowed(payload.safetyState)
    && typeof payload.createdAt === "number" && Number.isFinite(payload.createdAt) && payload.createdAt <= now && now - payload.createdAt <= REVIEW_PAYLOAD_TTL_MS;
}

export function authorizeReviewPayload(pgn: string, safetyState: GameSafetyState): ReviewPayload {
  assertAnalysisAllowed(safetyState);
  if (!pgn.trim() || pgn.length > 2_000_000) throw new Error("Invalid PGN payload.");
  return { pgn, safetyState, createdAt: Date.now() };
}

async function storedJob(analysisId: string): Promise<AnalysisJob | undefined> {
  return (await chrome.storage.session.get(jobKey(analysisId)))[jobKey(analysisId)] as AnalysisJob | undefined;
}
async function persistJob(job: AnalysisJob): Promise<void> {
  await chrome.storage.session.set({ [jobKey(job.analysisId)]: job, lastAnalysisId: job.analysisId });
}
async function ensureOffscreenHost(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: [chrome.offscreen.Reason.WORKERS], justification: "Run an explicitly authorized post-game Stockfish analysis independently of the popup." });
}
function isOffscreenSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL("offscreen.html");
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isExtensionMessage(message)) { sendResponse({ ok: false, error: "Malformed extension message." }); return false; }
  if (message.type === "START_REVIEW") {
    if (!isAnalysisAllowed(message.safetyState)) { debugLog("guard_blocked", { state: message.safetyState }); sendResponse({ ok: false, error: "Analysis blocked by the live-game guard." }); return false; }
    try { const payload = authorizeReviewPayload(message.pgn, message.safetyState); const token = crypto.randomUUID(); payloads.set(token, payload); void chrome.storage.session.set({ [`review:${token}`]: payload }); sendResponse({ ok: true, token }); }
    catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to start review." }); }
    return true;
  }
  if (message.type === "GET_REVIEW_PAYLOAD") {
    const memory = payloads.get(message.token);
    if (memory && isReviewPayloadActive(memory)) { sendResponse({ ok: true, payload: memory }); return false; }
    if (memory) payloads.delete(message.token);
    void chrome.storage.session.get(`review:${message.token}`).then((stored) => { const key = `review:${message.token}`; const payload = stored[key]; if (!isReviewPayloadActive(payload)) { void chrome.storage.session.remove(key); sendResponse({ ok: false, error: "Review session expired." }); } else { payloads.set(message.token, payload); sendResponse({ ok: true, payload }); } });
    return true;
  }
  if (message.type === "START_ANALYSIS") {
    void (async () => {
      try {
        assertAnalysisAllowed(message.safetyState); const game = parsePgn(message.pgn); const fingerprint = gameFingerprint(game); const settings = await getSettings();
        const storedActiveId = (await chrome.storage.session.get(activeKey(fingerprint)))[activeKey(fingerprint)] as string | undefined;
        const active = storedActiveId ? await storedJob(storedActiveId) : undefined;
        if (active && ["queued", "analyzing", "completed"].includes(active.summary.status)) { sendResponse({ ok: true, analysisId: active.analysisId, summary: active.summary, attached: true }); return; }
        const classifierMode = settings.compatibilityClassifier ? "compatibility" : "strict";
        const cached = settings.cachePreviousReviews ? await findCachedReview({ fingerprint, preset: settings.analysisQuality, engineVersion: ENGINE_VERSION, analysisModelVersion: ANALYSIS_MODEL_VERSION, expectedPointsModelVersion: EXPECTED_POINTS_MODEL_VERSION, classifierVersion: CLASSIFIER_VERSION, classifierMode }) : undefined;
        if (cached) { const summary = completedReviewSummary(cached.analysisId, cached.results); await chrome.storage.session.set({ lastAnalysisId: cached.analysisId, [jobKey(cached.analysisId)]: { analysisId: cached.analysisId, hostToken: "cached", fingerprint, pgn: message.pgn, safetyState: message.safetyState, summary } }); sendResponse({ ok: true, analysisId: cached.analysisId, summary, cached: true }); return; }
        const analysisId = crypto.randomUUID(); const hostToken = crypto.randomUUID();
        const job: AnalysisJob = { analysisId, hostToken, fingerprint, pgn: message.pgn, safetyState: message.safetyState, summary: createQueuedSummary(analysisId, game.headers.White ?? "White", game.headers.Black ?? "Black", game.moves.length) };
        const started = coordinator.start(job); await persistJob(started.job); await chrome.storage.session.set({ [activeKey(fingerprint)]: started.job.analysisId });
        if (started.created) {
          await ensureOffscreenHost();
          await chrome.runtime.sendMessage({ type: "RUN_ANALYSIS", analysisId: started.job.analysisId, hostToken: started.job.hostToken, pgn: started.job.pgn, safetyState: started.job.safetyState });
        }
        sendResponse({ ok: true, analysisId: started.job.analysisId, summary: started.job.summary, attached: !started.created });
      } catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to start analysis." }); }
    })(); return true;
  }
  if (message.type === "GET_ACTIVE_ANALYSIS") {
    void (async () => { const id = (await chrome.storage.session.get("lastAnalysisId")).lastAnalysisId as string | undefined; const job = id ? await storedJob(id) : undefined; sendResponse({ ok: true, analysisId: id, summary: job?.summary }); })(); return true;
  }
  if (message.type === "GET_ANALYSIS_STATE") { void storedJob(message.analysisId).then((job) => sendResponse(job ? { ok: true, summary: job.summary } : { ok: false, error: "Analysis not found." })); return true; }
  if (message.type === "VALIDATE_ANALYSIS_JOB") {
    if (!isOffscreenSender(sender)) { sendResponse({ ok: false }); return false; }
    void storedJob(message.analysisId).then((job) => sendResponse({ ok: Boolean(job && job.hostToken === message.hostToken && isAnalysisAllowed(job.safetyState)) })); return true;
  }
  if (message.type === "ANALYSIS_UPDATE") {
    if (!isOffscreenSender(sender)) { sendResponse({ ok: false }); return false; }
    void (async () => { const job = await storedJob(message.analysisId); if (!job || job.hostToken !== message.hostToken) { sendResponse({ ok: false }); return; } job.summary = message.summary; coordinator.update(job.analysisId, job.hostToken, job.summary); await persistJob(job); if (["completed", "cancelled", "failed"].includes(job.summary.status)) await chrome.storage.session.remove(activeKey(job.fingerprint)); sendResponse({ ok: true }); })(); return true;
  }
  if (message.type === "CANCEL_ANALYSIS") {
    void (async () => { const job = await storedJob(message.analysisId); if (!job || !isAnalysisAllowed(job.safetyState)) { sendResponse({ ok: false }); return; } job.summary = { ...job.summary, status: "cancelled" }; coordinator.cancel(job.analysisId); await persistJob(job); await chrome.storage.session.remove(activeKey(job.fingerprint)); await chrome.runtime.sendMessage({ type: "CANCEL_HOST_ANALYSIS", analysisId: job.analysisId, hostToken: job.hostToken }); sendResponse({ ok: true }); })(); return true;
  }
  if (message.type === "OPEN_ANALYSIS") { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?analysisId=${encodeURIComponent(message.analysisId)}`) }); sendResponse({ ok: true }); return false; }
  if (message.type === "OPEN_REVIEW") { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?token=${encodeURIComponent(message.token)}`) }); sendResponse({ ok: true }); return false; }
  return false;
});
