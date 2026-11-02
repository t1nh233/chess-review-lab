import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Popup } from "../../src/popup/Popup";
import type { ReviewSummary } from "../../src/popup/reviewSummary";

function summary(status: ReviewSummary["status"]): ReviewSummary {
  return { analysisId: "analysis-123", status, currentPly: 2, totalPlies: 2, whiteName: "White", blackName: "Black", whiteAccuracy: 90, blackAccuracy: 88, moves: [] };
}

function installChrome(initial: ReviewSummary) {
  const sendMessage = vi.fn(async (message: { type: string }) => {
    if (message.type === "GET_ACTIVE_ANALYSIS") return { ok: true, summary: initial };
    return { ok: true };
  });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage, getURL: (path: string) => `chrome-extension://test/${path}` },
    tabs: { query: vi.fn(async () => [{ id: 1, url: "edge://extensions" }]), sendMessage: vi.fn(), create: vi.fn() },
  });
  return sendMessage;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("popup reset wiring", () => {
  it("leaves a completed summary ready for a new analysis without deleting its cache", async () => {
    const sendMessage = installChrome(summary("completed"));
    render(<Popup/>);
    fireEvent.click(await screen.findByRole("button", { name: "Phân tích ván mới" }));
    expect(await screen.findByRole("button", { name: /Nhập PGN/i })).toBeInTheDocument();
    const types = sendMessage.mock.calls.map(([message]) => message.type);
    expect(types).toContain("DISMISS_ANALYSIS");
    expect(types).not.toContain("START_ANALYSIS");
    expect(types.some((type) => type.includes("DELETE"))).toBe(false);
  });

  it("cancels an active run before returning to the ready state", async () => {
    const sendMessage = installChrome(summary("analyzing"));
    render(<Popup/>);
    fireEvent.click(await screen.findByRole("button", { name: "Dừng và thoát" }));
    expect(await screen.findByRole("button", { name: /Nhập PGN/i })).toBeInTheDocument();
    // The popup polls GET_ANALYSIS_STATE every 300 ms while a run is active; that polling is expected and timing dependent.
    expect(sendMessage.mock.calls.map(([message]) => message.type).filter((type) => type !== "GET_ANALYSIS_STATE")).toEqual([
      "GET_ACTIVE_ANALYSIS", "CANCEL_ANALYSIS", "DISMISS_ANALYSIS",
    ]);
  });
});

describe("Chess.com just-finished game popup", () => {
  function installGameSnapshot(snapshot: unknown, existing?: ReviewSummary) {
    const sendMessage = vi.fn(async (message: { type: string }) => {
      if (message.type === "GET_ACTIVE_ANALYSIS") return { ok: true };
      if (message.type === "GET_COMPLETED_ANALYSIS") return existing
        ? { ok: true, summary: existing }
        : snapshot && typeof snapshot === "object" && "pgn" in snapshot && snapshot.pgn
          ? { ok: true, acquisition: { status: "available", source: "page", pgn: snapshot.pgn } }
          : { ok: true, acquisition: { status: "unavailable", reason: "not available" } };
      if (message.type === "START_COMPLETED_ANALYSIS") return { ok: true, summary: summary("queued") };
      return { ok: true };
    });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage, getURL: (path: string) => `chrome-extension://test/${path}` },
      tabs: { query: vi.fn(async () => [{ id: 7, url: "https://www.chess.com/game/live/123" }]), sendMessage: vi.fn(async () => snapshot), create: vi.fn() },
    });
    return sendMessage;
  }

  const completedSnapshot = { safetyState: "SAFE_COMPLETED_GAME", pgn: `[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1`, url: "https://www.chess.com/game/live/123", completedGame: { gameId: "123", gameUrl: "https://www.chess.com/game/live/123", result: "0-1", moveCount: 4 } };

  it("blocks LIVE_GAME and UNKNOWN without showing the last-game action", async () => {
    installGameSnapshot({ safetyState: "LIVE_GAME", pgn: null, url: "https://www.chess.com/game/live/123" });
    const view = render(<Popup/>);
    expect(await screen.findByText("Ván đang diễn ra")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phân tích ván vừa chơi" })).not.toBeInTheDocument();
    view.unmount(); vi.unstubAllGlobals();
    installGameSnapshot({ safetyState: "UNKNOWN", pgn: null, url: "https://www.chess.com/game/live/123" });
    render(<Popup/>);
    expect(await screen.findByText("Chưa xác nhận được ván")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phân tích ván vừa chơi" })).not.toBeInTheDocument();
  });

  it("offers the just-finished action and starts exactly one revalidated analysis on click", async () => {
    const sendMessage = installGameSnapshot(completedSnapshot);
    render(<Popup/>);
    fireEvent.click(await screen.findByRole("button", { name: "Phân tích ván vừa chơi" }));
    expect(await screen.findByLabelText("Tiến độ phân tích")).toBeInTheDocument();
    expect(sendMessage.mock.calls.filter(([message]) => message.type === "START_COMPLETED_ANALYSIS")).toHaveLength(1);
  });

  it("shows an existing compatible review immediately without starting Stockfish", async () => {
    const sendMessage = installGameSnapshot(completedSnapshot, summary("completed"));
    render(<Popup/>);
    expect(await screen.findByRole("button", { name: "Phân tích ván mới" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem lại phân tích" })).toBeInTheDocument();
    expect(sendMessage.mock.calls.some(([message]) => message.type === "START_COMPLETED_ANALYSIS")).toBe(false);
  });

  it("keeps completed status and offers manual PGN fallback when extraction fails", async () => {
    installGameSnapshot({ ...completedSnapshot, pgn: null });
    render(<Popup/>);
    expect(await screen.findByText("Không thể lấy PGN tự động.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dán PGN" })).toBeInTheDocument();
  });

  it("shows pending acquisition without exposing an analysis action", async () => {
    const sendMessage = vi.fn(async (message: { type: string }) => message.type === "GET_ACTIVE_ANALYSIS"
      ? { ok: true }
      : message.type === "GET_COMPLETED_ANALYSIS"
        ? { ok: true, acquisition: { status: "pending" } }
        : { ok: true });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage, getURL: (path: string) => `chrome-extension://test/${path}` },
      tabs: { query: vi.fn(async () => [{ id: 7, url: completedSnapshot.url }]), sendMessage: vi.fn(async () => ({ ...completedSnapshot, pgn: null })), create: vi.fn() },
    });
    render(<Popup/>);
    expect(await screen.findByText("Đang lấy PGN của ván đấu...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phân tích ván vừa chơi" })).not.toBeInTheDocument();
  });

  it("detects the newer completed tab after leaving an old review", async () => {
    const sendMessage = vi.fn(async (message: { type: string }) => {
      if (message.type === "GET_ACTIVE_ANALYSIS") return { ok: true, summary: summary("completed") };
      if (message.type === "GET_COMPLETED_ANALYSIS") return { ok: true, acquisition: { status: "available", source: "page", pgn: completedSnapshot.pgn } };
      return { ok: true };
    });
    vi.stubGlobal("chrome", {
      runtime: { sendMessage, getURL: (path: string) => `chrome-extension://test/${path}` },
      tabs: { query: vi.fn(async () => [{ id: 7, url: "https://www.chess.com/game/live/456" }]), sendMessage: vi.fn(async () => ({ ...completedSnapshot, url: "https://www.chess.com/game/live/456", completedGame: { ...completedSnapshot.completedGame, gameId: "456", gameUrl: "https://www.chess.com/game/live/456" } })), create: vi.fn() },
    });
    render(<Popup/>);
    fireEvent.click(await screen.findByRole("button", { name: "Phân tích ván mới" }));
    expect(await screen.findByRole("button", { name: "Phân tích ván vừa chơi" })).toBeInTheDocument();
    expect(sendMessage.mock.calls.some(([message]) => message.type === "START_COMPLETED_ANALYSIS")).toBe(false);
  });
});
