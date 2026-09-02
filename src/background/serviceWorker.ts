import { isExtensionMessage } from "./messages";
import { assertAnalysisAllowed, isAnalysisAllowed, isGameSafetyState, type GameSafetyState } from "../safety/liveGameGuard";
import { debugLog } from "../utils/logger";

export interface ReviewPayload { pgn: string; safetyState: GameSafetyState; createdAt: number }
export const REVIEW_PAYLOAD_TTL_MS = 30 * 60 * 1000;
const payloads = new Map<string, ReviewPayload>();

export function isReviewPayloadActive(value: unknown, now = Date.now()): value is ReviewPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ReviewPayload>;
  return typeof payload.pgn === "string"
    && payload.pgn.trim().length > 0
    && payload.pgn.length <= 2_000_000
    && isGameSafetyState(payload.safetyState)
    && isAnalysisAllowed(payload.safetyState)
    && typeof payload.createdAt === "number"
    && Number.isFinite(payload.createdAt)
    && payload.createdAt <= now
    && now - payload.createdAt <= REVIEW_PAYLOAD_TTL_MS;
}

export function authorizeReviewPayload(pgn: string, safetyState: GameSafetyState): ReviewPayload {
  assertAnalysisAllowed(safetyState);
  if (!pgn.trim() || pgn.length > 2_000_000) throw new Error("Invalid PGN payload.");
  return { pgn, safetyState, createdAt: Date.now() };
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) { sendResponse({ ok: false, error: "Malformed extension message." }); return false; }
  if (message.type === "START_REVIEW") {
    if (!isAnalysisAllowed(message.safetyState)) { debugLog("guard_blocked", { state: message.safetyState }); sendResponse({ ok: false, error: "Analysis blocked by the live-game guard." }); return false; }
    try {
      const payload = authorizeReviewPayload(message.pgn, message.safetyState);
      const token = crypto.randomUUID();
      payloads.set(token, payload);
      void chrome.storage.session.set({ [`review:${token}`]: payload });
      sendResponse({ ok: true, token });
    } catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to start review." }); }
    return true;
  }
  if (message.type === "GET_REVIEW_PAYLOAD") {
    const memory = payloads.get(message.token);
    if (memory && isReviewPayloadActive(memory)) { sendResponse({ ok: true, payload: memory }); return false; }
    if (memory) payloads.delete(message.token);
    void chrome.storage.session.get(`review:${message.token}`).then((stored) => {
      const key = `review:${message.token}`;
      const payload = stored[key];
      if (!isReviewPayloadActive(payload)) {
        void chrome.storage.session.remove(key);
        sendResponse({ ok: false, error: "Review session expired." });
      } else {
        payloads.set(message.token, payload);
        sendResponse({ ok: true, payload });
      }
    });
    return true;
  }
  if (message.type === "OPEN_REVIEW") {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?token=${encodeURIComponent(message.token)}`) });
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
