export type GameSafetyState = "SAFE_COMPLETED_GAME" | "SAFE_IMPORTED_PGN" | "LIVE_GAME" | "UNKNOWN";

const GAME_SAFETY_STATES: readonly GameSafetyState[] = ["SAFE_COMPLETED_GAME", "SAFE_IMPORTED_PGN", "LIVE_GAME", "UNKNOWN"];

export function isGameSafetyState(value: unknown): value is GameSafetyState {
  return typeof value === "string" && GAME_SAFETY_STATES.includes(value as GameSafetyState);
}

export interface GameSafetyEvidence {
  source: "chess.com" | "import" | "review" | "unknown";
  url?: string;
  explicitResult?: string;
  liveIndicators?: string[];
  completedIndicators?: string[];
}

const FINAL_RESULTS = new Set(["1-0", "0-1", "1/2-1/2"]);

export function detectGameSafetyState(evidence: GameSafetyEvidence): GameSafetyState {
  if (evidence.source === "import") return "SAFE_IMPORTED_PGN";
  if (evidence.source !== "chess.com") return "UNKNOWN";
  if (evidence.liveIndicators?.length) return "LIVE_GAME";
  const resultIsFinal = Boolean(evidence.explicitResult && FINAL_RESULTS.has(evidence.explicitResult));
  const hasCompletionProof = Boolean(evidence.completedIndicators?.length);
  return resultIsFinal && hasCompletionProof ? "SAFE_COMPLETED_GAME" : "UNKNOWN";
}

export function isAnalysisAllowed(state: GameSafetyState): boolean {
  return state === "SAFE_COMPLETED_GAME" || state === "SAFE_IMPORTED_PGN";
}

export function assertAnalysisAllowed(state: GameSafetyState): void {
  if (!isAnalysisAllowed(state)) {
    throw new Error(state === "LIVE_GAME"
      ? "This game appears to still be in progress. Analysis is disabled."
      : "Unable to verify that the game has ended.");
  }
}
