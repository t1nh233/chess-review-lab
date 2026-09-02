import { describe, expect, it, vi } from "vitest";
import { analyzeGame } from "../../src/analysis/analyzeGame";
import { parsePgn } from "../../src/chess/pgn";
import { detectGameSafetyState, isAnalysisAllowed } from "../../src/safety/liveGameGuard";
import { CLEAN_GAME } from "../fixtures/games";
describe("live game guard", () => {
  it("blocks a live Chess.com game", () => expect(detectGameSafetyState({ source:"chess.com", explicitResult:"1-0", liveIndicators:["clock"], completedIndicators:["modal"] })).toBe("LIVE_GAME"));
  it("blocks unknown state", () => expect(isAnalysisAllowed(detectGameSafetyState({ source:"chess.com", completedIndicators:["modal"] }))).toBe(false));
  it("allows only positively completed games", () => expect(detectGameSafetyState({ source:"chess.com", explicitResult:"1-0", completedIndicators:["modal"] })).toBe("SAFE_COMPLETED_GAME"));
  it("allows imported PGN", () => expect(detectGameSafetyState({ source:"import" })).toBe("SAFE_IMPORTED_PGN"));
  it.each(["LIVE_GAME", "UNKNOWN"] as const)("prevents the analysis pipeline from bypassing the guard for %s", async (safetyState) => { const engine = { initialize:vi.fn(), analyze:vi.fn(), stop:vi.fn(), dispose:vi.fn() }; await expect(analyzeGame(parsePgn(CLEAN_GAME), engine, { safetyState, preset:"quick" })).rejects.toThrow(/progress|verify/); expect(engine.initialize).not.toHaveBeenCalled(); expect(engine.analyze).not.toHaveBeenCalled(); });
});
