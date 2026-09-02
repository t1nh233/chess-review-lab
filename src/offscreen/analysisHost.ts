import { analyzeGame, ENGINE_PRESETS } from "../analysis/analyzeGame";
import { gameFingerprint, parsePgn } from "../chess/pgn";
import { ANALYSIS_MODEL_VERSION, CLASSIFIER_VERSION, ENGINE_VERSION, EXPECTED_POINTS_MODEL_VERSION } from "../config/versions";
import { StockfishClient } from "../engine/stockfishClient";
import { isExtensionMessage } from "../background/messages";
import { completedReviewSummary, createQueuedSummary, type ReviewSummary } from "../popup/reviewSummary";
import { assertHostAuthorization } from "./hostAuthorization";
import { findCachedReview, saveCachedReview } from "../storage/analysisCache";
import { getSettings } from "../storage/settings";

interface ActiveHostRun { hostToken: string; controller: AbortController; engine: StockfishClient }
const activeRuns = new Map<string, ActiveHostRun>();

async function publish(analysisId: string, hostToken: string, summary: ReviewSummary): Promise<void> {
  await chrome.runtime.sendMessage({ type: "ANALYSIS_UPDATE", analysisId, hostToken, summary });
}

async function runAnalysis(message: Extract<ReturnType<typeof asMessage>, { type: "RUN_ANALYSIS" }>): Promise<void> {
  if (activeRuns.has(message.analysisId)) return;
  const validation = await chrome.runtime.sendMessage({ type: "VALIDATE_ANALYSIS_JOB", analysisId: message.analysisId, hostToken: message.hostToken }) as { ok?: boolean };
  assertHostAuthorization(message.safetyState, Boolean(validation?.ok));
  const game = parsePgn(message.pgn); const settings = await getSettings(); const preset = ENGINE_PRESETS[settings.analysisQuality];
  const classifierMode = settings.compatibilityClassifier ? "compatibility" : "strict";
  const identity = { fingerprint: gameFingerprint(game), preset: settings.analysisQuality, engineVersion: ENGINE_VERSION, analysisModelVersion: ANALYSIS_MODEL_VERSION, expectedPointsModelVersion: EXPECTED_POINTS_MODEL_VERSION, classifierVersion: CLASSIFIER_VERSION, classifierMode } as const;
  const cached = settings.cachePreviousReviews ? await findCachedReview(identity) : undefined;
  if (cached) { await publish(message.analysisId, message.hostToken, { ...completedReviewSummary(cached.analysisId, cached.results), analysisId: message.analysisId }); return; }

  const controller = new AbortController(); const engine = new StockfishClient(); activeRuns.set(message.analysisId, { hostToken: message.hostToken, controller, engine });
  let summary = createQueuedSummary(message.analysisId, game.headers.White ?? "White", game.headers.Black ?? "Black", game.moves.length);
  summary = { ...summary, status: "analyzing", targetDepth: preset.depth }; await publish(message.analysisId, message.hostToken, summary);
  let lastPublished = 0; let currentDepth = 0; let currentPly = 0;
  const publishProgress = () => {
    const now = Date.now(); if (now - lastPublished < 150) return; lastPublished = now;
    void publish(message.analysisId, message.hostToken, { ...summary, currentPly, currentDepth: currentDepth || undefined });
  };
  try {
    const review = await analyzeGame(game, engine, {
      safetyState: message.safetyState, preset: settings.analysisQuality, compatibilityClassifier: settings.compatibilityClassifier, signal: controller.signal,
      onProgress: (done, total) => { currentPly = Math.min(game.moves.length, Math.floor(done * game.moves.length / total)); publishProgress(); },
      onEngineProgress: (progress) => { currentDepth = progress.currentDepth; publishProgress(); },
    });
    await saveCachedReview({ analysisId: message.analysisId, createdAt: Date.now(), gameFingerprint: identity.fingerprint, pgn: message.pgn, engineVersion: review.engineVersion, enginePreset: review.enginePreset, analysisModelVersion: review.analysisModelVersion, expectedPointsModelVersion: review.expectedPointsModelVersion, classifierVersion: review.classifierVersion, classifierMode: review.classifierMode, results: review }, settings.maxCachedReviews);
    await publish(message.analysisId, message.hostToken, completedReviewSummary(message.analysisId, review));
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    await publish(message.analysisId, message.hostToken, { ...summary, status: cancelled ? "cancelled" : "failed", currentPly, currentDepth: currentDepth || undefined, error: cancelled ? undefined : error instanceof Error ? error.message : "Analysis failed." });
  } finally { engine.dispose(); activeRuns.delete(message.analysisId); }
}

function asMessage(value: unknown) { return isExtensionMessage(value) ? value : null; }
chrome.runtime.onMessage.addListener((value: unknown) => {
  const message = asMessage(value); if (!message) return false;
  if (message.type === "RUN_ANALYSIS") { void runAnalysis(message); return false; }
  if (message.type === "CANCEL_HOST_ANALYSIS") {
    const run = activeRuns.get(message.analysisId);
    if (run?.hostToken === message.hostToken) { run.controller.abort(); void run.engine.stop(); }
  }
  return false;
});
