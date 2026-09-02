import type { GameSafetyState } from "../safety/liveGameGuard";
import { isGameSafetyState } from "../safety/liveGameGuard";
import { isReviewSummary, type ReviewSummary } from "../popup/reviewSummary";

export type ExtensionMessage =
  | { type: "INSPECT_PAGE" }
  | { type: "PAGE_SNAPSHOT" }
  | { type: "START_REVIEW"; pgn: string; safetyState: GameSafetyState }
  | { type: "GET_REVIEW_PAYLOAD"; token: string }
  | { type: "OPEN_REVIEW"; token: string }
  | { type: "START_ANALYSIS"; pgn: string; safetyState: GameSafetyState }
  | { type: "GET_ACTIVE_ANALYSIS" }
  | { type: "GET_ANALYSIS_STATE"; analysisId: string }
  | { type: "CANCEL_ANALYSIS"; analysisId: string }
  | { type: "OPEN_ANALYSIS"; analysisId: string }
  | { type: "RUN_ANALYSIS"; analysisId: string; hostToken: string; pgn: string; safetyState: GameSafetyState }
  | { type: "VALIDATE_ANALYSIS_JOB"; analysisId: string; hostToken: string }
  | { type: "ANALYSIS_UPDATE"; analysisId: string; hostToken: string; summary: ReviewSummary }
  | { type: "CANCEL_HOST_ANALYSIS"; analysisId: string; hostToken: string };

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== "object" || !("type" in value) || typeof (value as any).type !== "string") return false;
  const message = value as any;
  if (message.type === "INSPECT_PAGE" || message.type === "PAGE_SNAPSHOT" || message.type === "GET_ACTIVE_ANALYSIS") return true;
  if (message.type === "GET_REVIEW_PAYLOAD" || message.type === "OPEN_REVIEW") return typeof message.token === "string" && message.token.length > 0 && message.token.length <= 128;
  const validId = (id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 128;
  if (["GET_ANALYSIS_STATE", "CANCEL_ANALYSIS", "OPEN_ANALYSIS"].includes(message.type)) return validId(message.analysisId);
  if (message.type === "START_REVIEW" || message.type === "START_ANALYSIS") return typeof message.pgn === "string" && message.pgn.length <= 2_000_000 && isGameSafetyState(message.safetyState);
  if (message.type === "RUN_ANALYSIS") return validId(message.analysisId) && validId(message.hostToken) && typeof message.pgn === "string" && message.pgn.length <= 2_000_000 && isGameSafetyState(message.safetyState);
  if (message.type === "VALIDATE_ANALYSIS_JOB" || message.type === "CANCEL_HOST_ANALYSIS") return validId(message.analysisId) && validId(message.hostToken);
  if (message.type === "ANALYSIS_UPDATE") return validId(message.analysisId) && validId(message.hostToken) && isReviewSummary(message.summary);
  return false;
}
