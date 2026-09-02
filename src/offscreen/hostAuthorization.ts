import type { GameSafetyState } from "../safety/liveGameGuard";
import { assertAnalysisAllowed } from "../safety/liveGameGuard";

export function assertHostAuthorization(safetyState: GameSafetyState, tokenValidated: boolean): void {
  assertAnalysisAllowed(safetyState);
  if (!tokenValidated) throw new Error("Analysis host authorization failed.");
}
