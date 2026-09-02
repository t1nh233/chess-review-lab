import type { GameSafetyState } from "../safety/liveGameGuard";
import { isGameSafetyState } from "../safety/liveGameGuard";

export type ExtensionMessage =
  | { type: "INSPECT_PAGE" }
  | { type: "PAGE_SNAPSHOT" }
  | { type: "START_REVIEW"; pgn: string; safetyState: GameSafetyState }
  | { type: "GET_REVIEW_PAYLOAD"; token: string }
  | { type: "OPEN_REVIEW"; token: string };

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== "object" || !("type" in value) || typeof (value as any).type !== "string") return false;
  const message = value as any;
  if (message.type === "INSPECT_PAGE" || message.type === "PAGE_SNAPSHOT") return true;
  if (message.type === "GET_REVIEW_PAYLOAD" || message.type === "OPEN_REVIEW") return typeof message.token === "string" && message.token.length > 0 && message.token.length <= 128;
  if (message.type === "START_REVIEW") return typeof message.pgn === "string" && message.pgn.length <= 2_000_000 && isGameSafetyState(message.safetyState);
  return false;
}
