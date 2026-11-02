import { isExtensionMessage } from "./messages";
import { AnalysisCoordinator, type AnalysisJob } from "./analysisCoordinator";
import { completedReviewSummary, createQueuedSummary } from "../popup/reviewSummary";
import { assertAnalysisAllowed, isAnalysisAllowed, isGameSafetyState, type GameSafetyState } from "../safety/liveGameGuard";
import { gameFingerprint, parsePgn } from "../chess/pgn";
import { ANALYSIS_MODEL_VERSION, CLASSIFIER_VERSION, ENGINE_VERSION, EXPECTED_POINTS_MODEL_VERSION } from "../config/versions";
import { findCachedReview } from "../storage/analysisCache";
import { getSettings } from "../storage/settings";
import { debugLog } from "../utils/logger";
import { startLatestGameWatcher } from "./latestGameWatcher";
import type { ChessComPageSnapshot } from "../adapters/chessCom/pageAdapter";
import { extractChessComGameId, normalizedGameIdentityKey, type CompletedGameIdentity } from "../adapters/chessCom/completedGameIdentity";
import { acquireCompletedGamePgn, acquireCompletedGamePgnWithRetry, validateAcquiredPgn, type PgnAcquisitionResult, type PgnCache } from "../adapters/chessCom/pgnAcquisition";

export interface ReviewPayload { pgn: string; safetyState: GameSafetyState; createdAt: number }
export const REVIEW_PAYLOAD_TTL_MS = 30 * 60 * 1000;
const payloads = new Map<string, ReviewPayload>();
const coordinator = new AnalysisCoordinator();
const jobKey = (analysisId: string) => `analysis-job:${analysisId}`;
const activeKey = (fingerprint: string) => `analysis-active:${fingerprint}`;
const dismissedKey = (analysisId: string) => `analysis-dismissed:${analysisId}`;
const acquisitionJobs = new Map<string, Promise<void>>();

interface StoredPgnAcquisition {
  identity: CompletedGameIdentity;
  result: PgnAcquisitionResult;
  attempt: number;
  updatedAt: number;
}

const acquisitionKey = (identityKey: string) => `completed-pgn-state:${identityKey}`;
const cachedPgnKey = (identityKey: string) => `completed-pgn:${identityKey}`;
const pgnCache: PgnCache = {
  async get(key) { return (await chrome.storage.local.get(cachedPgnKey(key)))[cachedPgnKey(key)] as string | undefined; },
  async set(key, pgn) { await chrome.storage.local.set({ [cachedPgnKey(key)]: pgn }); },
};

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
  const dismissed = Boolean((await chrome.storage.session.get(dismissedKey(job.analysisId)))[dismissedKey(job.analysisId)]);
  await chrome.storage.session.set({ [jobKey(job.analysisId)]: job });
  if (!dismissed) await chrome.storage.session.set({ lastAnalysisId: job.analysisId });
}
async function ensureOffscreenHost(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: [chrome.offscreen.Reason.WORKERS], justification: "Run an explicitly authorized post-game Stockfish analysis independently of the popup." });
}
function isOffscreenSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL("offscreen.html");
}

/**
 * Completion proof independent of fragile page markup: the public archive only lists finished games,
 * so a game id found there (with a final PGN result) cannot be a game in progress.
 */
async function archiveVerifiedSnapshot(tabId: number, expectedGameId?: string): Promise<ChessComPageSnapshot | undefined> {
  const page = await chrome.tabs.sendMessage(tabId, { type: "INSPECT_PAGE" }) as ChessComPageSnapshot | undefined;
  if (!page?.url) return undefined;
  const gameId = page.hints?.gameId ?? extractChessComGameId(page.url);
  if (!gameId || (expectedGameId && expectedGameId !== gameId)) return undefined;
  const identity: CompletedGameIdentity = { gameId, url: page.url, candidateUsernames: page.hints?.candidateUsernames ?? [] };
  const result = await acquireCompletedGamePgn(identity, { fetchFn: fetch, cache: pgnCache, attempt: 0, maxAttempts: 1 });
  if (result.status !== "available") return undefined;
  let parsed;
  try { parsed = parsePgn(result.pgn); } catch { return undefined; }
  if (!parsed.moves.length || !parsed.result || !["1-0", "0-1", "1/2-1/2"].includes(parsed.result)) return undefined;
  const completedGame = { ...identity, gameUrl: page.url, whiteUsername: parsed.headers.White, blackUsername: parsed.headers.Black, result: parsed.result };
  return { safetyState: "SAFE_COMPLETED_GAME", pgn: result.pgn, url: page.url, hints: page.hints, completedGame };
}

async function validatedCompletedSnapshot(tabId: number, expectedGameId?: string): Promise<ChessComPageSnapshot> {
  const snapshot = await chrome.tabs.sendMessage(tabId, { type: "INSPECT_PAGE" }) as ChessComPageSnapshot;
  if (snapshot?.safetyState !== "SAFE_COMPLETED_GAME") {
    const proven = await archiveVerifiedSnapshot(tabId, expectedGameId);
    if (proven) return proven;
    throw new Error("Chưa xác nhận được ván này đã kết thúc. Hãy mở lại popup sau vài giây.");
  }
  const actualGameId = snapshot.completedGame?.gameId ?? extractChessComGameId(snapshot.url);
  if (expectedGameId && actualGameId !== expectedGameId) throw new Error("Ván đang mở đã thay đổi trước khi phân tích bắt đầu. Hãy thử lại.");
  return snapshot;
}

function identityFromSnapshot(snapshot: ChessComPageSnapshot): CompletedGameIdentity {
  return snapshot.completedGame ?? { gameId: extractChessComGameId(snapshot.url), url: snapshot.url };
}

function identityStorageKey(identity: CompletedGameIdentity): string {
  return normalizedGameIdentityKey(identity) ?? `chesscom-url:${encodeURIComponent(identity.url)}`;
}

async function persistAcquisition(identity: CompletedGameIdentity, result: PgnAcquisitionResult, attempt: number): Promise<void> {
  const state: StoredPgnAcquisition = { identity, result, attempt, updatedAt: Date.now() };
  await chrome.storage.local.set({ [acquisitionKey(identityStorageKey(identity))]: state });
}

async function storedAcquisition(identity: CompletedGameIdentity): Promise<StoredPgnAcquisition | undefined> {
  const key = acquisitionKey(identityStorageKey(identity));
  return (await chrome.storage.local.get(key))[key] as StoredPgnAcquisition | undefined;
}

async function ensureCompletedPgn(tabId: number, expectedGameId?: string, force = false): Promise<{ snapshot: ChessComPageSnapshot; acquisition: PgnAcquisitionResult }> {
  const snapshot = await validatedCompletedSnapshot(tabId, expectedGameId);
  const identity = identityFromSnapshot(snapshot);
  const key = identityStorageKey(identity);
  const cachedPgn = await pgnCache.get(key);
  if (cachedPgn) {
    try {
      const result: PgnAcquisitionResult = { status: "available", source: "pubapi", pgn: validateAcquiredPgn(cachedPgn, identity) };
      await persistAcquisition(identity, result, 0);
      return { snapshot, acquisition: result };
    } catch { /* Ignore a stale identity cache entry. */ }
  }
  if (snapshot.pgn) {
    try {
      const pgn = validateAcquiredPgn(snapshot.pgn, identity);
      await pgnCache.set(key, pgn);
      const result: PgnAcquisitionResult = { status: "available", source: "page", pgn };
      await persistAcquisition(identity, result, 0);
      return { snapshot, acquisition: result };
    } catch { /* Fall through to the public archive. */ }
  }
  const stored = await storedAcquisition(identity);
  if (!force && (stored?.result.status === "available" || stored?.result.status === "unavailable" || stored?.result.status === "error")) {
    return { snapshot, acquisition: stored.result };
  }
  if (!acquisitionJobs.has(key)) {
    await persistAcquisition(identity, { status: "pending" }, 0);
    const job = acquireCompletedGamePgnWithRetry(identity, {
      fetchFn: fetch,
      cache: pgnCache,
      onResult: (result, attempt) => persistAcquisition(identity, result, attempt),
    }).then(async (result) => { await persistAcquisition(identity, result, 3); })
      .catch(async (error) => { await persistAcquisition(identity, { status: "error", reason: error instanceof Error ? error.message : "Unable to acquire PGN." }, 3); })
      .finally(() => { acquisitionJobs.delete(key); });
    acquisitionJobs.set(key, job);
  }
  return { snapshot, acquisition: { status: "pending" } };
}

async function existingAnalysis(pgn: string, safetyState: GameSafetyState, runFingerprint: string) {
  const game = parsePgn(pgn); const fingerprint = gameFingerprint(game); const settings = await getSettings();
  const storedActiveId = (await chrome.storage.session.get(activeKey(runFingerprint)))[activeKey(runFingerprint)] as string | undefined;
  const active = storedActiveId ? await storedJob(storedActiveId) : undefined;
  if (active && ["queued", "analyzing", "completed"].includes(active.summary.status)) return { ok: true, analysisId: active.analysisId, summary: active.summary, attached: true };
  const classifierMode = settings.compatibilityClassifier ? "compatibility" : "strict";
  const cached = settings.cachePreviousReviews ? await findCachedReview({ fingerprint, preset: settings.analysisQuality, engineVersion: ENGINE_VERSION, analysisModelVersion: ANALYSIS_MODEL_VERSION, expectedPointsModelVersion: EXPECTED_POINTS_MODEL_VERSION, classifierVersion: CLASSIFIER_VERSION, classifierMode }) : undefined;
  if (!cached) return undefined;
  const summary = completedReviewSummary(cached.analysisId, cached.results);
  await chrome.storage.session.remove(dismissedKey(cached.analysisId));
  await chrome.storage.session.set({ lastAnalysisId: cached.analysisId, [jobKey(cached.analysisId)]: { analysisId: cached.analysisId, hostToken: "cached", fingerprint: runFingerprint, pgn, safetyState, summary } });
  return { ok: true, analysisId: cached.analysisId, summary, cached: true };
}

async function beginAnalysis(pgn: string, safetyState: GameSafetyState, preferredFingerprint?: string) {
  assertAnalysisAllowed(safetyState); const game = parsePgn(pgn); const fingerprint = gameFingerprint(game); const runFingerprint = preferredFingerprint ?? fingerprint;
  const existing = await existingAnalysis(pgn, safetyState, runFingerprint);
  if (existing) return existing;
  const analysisId = crypto.randomUUID(); const hostToken = crypto.randomUUID();
  const job: AnalysisJob = { analysisId, hostToken, fingerprint: runFingerprint, pgn, safetyState, summary: createQueuedSummary(analysisId, game.headers.White ?? "White", game.headers.Black ?? "Black", game.moves.length) };
  const started = coordinator.start(job); await persistJob(started.job); await chrome.storage.session.set({ [activeKey(runFingerprint)]: started.job.analysisId });
  if (started.created) {
    await ensureOffscreenHost();
    await chrome.runtime.sendMessage({ type: "RUN_ANALYSIS", analysisId: started.job.analysisId, hostToken: started.job.hostToken, pgn: started.job.pgn, safetyState: started.job.safetyState });
  }
  return { ok: true, analysisId: started.job.analysisId, summary: started.job.summary, attached: !started.created };
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
        if (message.safetyState !== "SAFE_IMPORTED_PGN") throw new Error("Completed Chess.com games require tab revalidation.");
        sendResponse(await beginAnalysis(message.pgn, message.safetyState));
      } catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to start analysis." }); }
    })(); return true;
  }
  if (message.type === "START_COMPLETED_ANALYSIS" || message.type === "GET_COMPLETED_ANALYSIS" || message.type === "RETRY_COMPLETED_PGN") {
    void (async () => {
      try {
        const { snapshot, acquisition } = await ensureCompletedPgn(message.tabId, message.expectedGameId, message.type === "RETRY_COMPLETED_PGN");
        if (acquisition.status !== "available") { sendResponse({ ok: true, acquisition }); return; }
        const identity = identityFromSnapshot(snapshot);
        const runFingerprint = identity.gameId ? `chesscom:${identity.gameId}` : gameFingerprint(parsePgn(acquisition.pgn));
        const existing = await existingAnalysis(acquisition.pgn, "SAFE_COMPLETED_GAME", runFingerprint);
        if (message.type !== "START_COMPLETED_ANALYSIS" || existing) { sendResponse({ ...(existing ?? { ok: true }), acquisition }); return; }
        await validatedCompletedSnapshot(message.tabId, message.expectedGameId);
        sendResponse({ ...await beginAnalysis(acquisition.pgn, "SAFE_COMPLETED_GAME", runFingerprint), acquisition });
      } catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to verify the completed game." }); }
    })(); return true;
  }
  if (message.type === "VERIFY_ARCHIVE_COMPLETION") {
    void archiveVerifiedSnapshot(message.tabId, message.expectedGameId)
      .then((snapshot) => sendResponse({ ok: Boolean(snapshot), snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Archive verification failed." }));
    return true;
  }
  if (message.type === "GAME_COMPLETED_AVAILABLE") {
    if (sender.tab?.id) {
      void chrome.storage.session.set({ [`completed-game:${sender.tab.id}`]: message.metadata });
      void ensureCompletedPgn(sender.tab.id, message.metadata.gameId).catch((error) => debugLog("completed_pgn_acquisition_failed", { error: error instanceof Error ? error.message : String(error) }));
    }
    sendResponse({ ok: true }); return false;
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
  if (message.type === "DISMISS_ANALYSIS") {
    void (async () => {
      const job = await storedJob(message.analysisId);
      if (job && (job.summary.status === "queued" || job.summary.status === "analyzing")) {
        sendResponse({ ok: false, error: "Cancel the active analysis before closing it." });
        return;
      }
      const activePointer = await chrome.storage.session.get("lastAnalysisId");
      await chrome.storage.session.set({ [dismissedKey(message.analysisId)]: true });
      if (activePointer.lastAnalysisId === message.analysisId) await chrome.storage.session.remove("lastAnalysisId");
      sendResponse({ ok: true });
    })(); return true;
  }
  if (message.type === "OPEN_ANALYSIS") { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?analysisId=${encodeURIComponent(message.analysisId)}`) }); sendResponse({ ok: true }); return false; }
  if (message.type === "OPEN_REVIEW") { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?token=${encodeURIComponent(message.token)}`) }); sendResponse({ ok: true }); return false; }
  return false;
});

startLatestGameWatcher();
