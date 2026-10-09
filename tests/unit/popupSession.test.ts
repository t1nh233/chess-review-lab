import { describe, expect, it, vi } from "vitest";
import { exitPopupAnalysis } from "../../src/popup/popupSession";
import type { ReviewSummary } from "../../src/popup/reviewSummary";

function summary(status: ReviewSummary["status"]): ReviewSummary {
  return { analysisId: "analysis-123", status, currentPly: 2, totalPlies: 2, whiteName: "White", blackName: "Black", moves: [] };
}

describe("popup analysis exit flow", () => {
  it("cancels an active run before detaching the popup session", async () => {
    const send = vi.fn(async (message: unknown) => { void message; return { ok: true }; });
    await exitPopupAnalysis(summary("analyzing"), send);
    expect(send.mock.calls.map(([message]) => message)).toEqual([
      { type: "CANCEL_ANALYSIS", analysisId: "analysis-123" },
      { type: "DISMISS_ANALYSIS", analysisId: "analysis-123" },
    ]);
  });

  it("detaches a completed review without deleting cache or starting another run", async () => {
    const send = vi.fn(async (message: unknown) => { void message; return { ok: true }; });
    await exitPopupAnalysis(summary("completed"), send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "DISMISS_ANALYSIS", analysisId: "analysis-123" });
    expect(send.mock.calls.flat().map(String).join(" ")).not.toMatch(/DELETE|START_ANALYSIS/);
  });
});
