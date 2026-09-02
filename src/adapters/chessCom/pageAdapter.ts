import { collectSafetyEvidence } from "./completedGameDetector";
import { extractPgn } from "./pgnExtractor";
import { detectGameSafetyState, type GameSafetyState } from "../../safety/liveGameGuard";

export interface ChessComPageSnapshot { safetyState: GameSafetyState; pgn: string | null; url: string }
export class ChessComPageAdapter {
  supports(url: string): boolean { try { return new URL(url).hostname === "www.chess.com"; } catch { return false; } }
  inspect(doc: Document, url: string): ChessComPageSnapshot {
    if (!this.supports(url)) return { safetyState: "UNKNOWN", pgn: null, url };
    const evidence = collectSafetyEvidence(doc, url);
    const safetyState = detectGameSafetyState(evidence);
    return { safetyState, pgn: safetyState === "SAFE_COMPLETED_GAME" ? extractPgn(doc) : null, url };
  }
}
