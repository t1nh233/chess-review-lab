import { DEBUG_ANALYSIS } from "../config/versions";

export function debugLog(event: string, details: Record<string, unknown> = {}): void {
  if (DEBUG_ANALYSIS) console.debug(`[Chess Review Lab] ${event}`, details);
}
