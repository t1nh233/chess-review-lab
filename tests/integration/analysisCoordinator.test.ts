import { describe, expect, it } from "vitest";
import { AnalysisCoordinator, type AnalysisJob } from "../../src/background/analysisCoordinator";
import type { GameSafetyState } from "../../src/safety/liveGameGuard";

const job = (analysisId: string, safetyState: GameSafetyState = "SAFE_IMPORTED_PGN"): AnalysisJob => ({
  analysisId, hostToken: `host-${analysisId}`, fingerprint: "same-game", pgn: "1. e4 e5 *", safetyState,
  summary: { analysisId, status: "analyzing", currentPly: 25, totalPlies: 118, whiteName: "White", blackName: "Black", moves: [] },
});

describe("durable analysis coordinator", () => {
  it.each(["LIVE_GAME", "UNKNOWN"] as const)("rejects %s before a host job can be created", (state) => expect(() => new AnalysisCoordinator().start(job("unsafe", state))).toThrow());
  it.each(["SAFE_COMPLETED_GAME", "SAFE_IMPORTED_PGN"] as const)("allows %s", (state) => expect(new AnalysisCoordinator().start(job("safe", state)).created).toBe(true));
  it("reconnects after a popup closes without losing progress", () => {
    const coordinator = new AnalysisCoordinator(); coordinator.start(job("run"));
    expect(coordinator.get("run")?.summary.currentPly).toBe(25);
    coordinator.update("run", "host-run", { ...job("run").summary, currentPly: 63 });
    expect(coordinator.current()?.summary.currentPly).toBe(63);
  });
  it("attaches to an existing game instead of starting a duplicate", () => {
    const coordinator = new AnalysisCoordinator(); const first = coordinator.start(job("first")); const second = coordinator.start(job("second"));
    expect(first.created).toBe(true); expect(second).toMatchObject({ created: false, job: { analysisId: "first" } });
  });
  it("rejects forged host updates and preserves cancellation", () => {
    const coordinator = new AnalysisCoordinator(); coordinator.start(job("run"));
    expect(coordinator.update("run", "wrong", { ...job("run").summary, currentPly: 99 })).toBe(false);
    expect(coordinator.cancel("run")).toBe(true); expect(coordinator.get("run")?.summary.status).toBe("cancelled");
  });
});
