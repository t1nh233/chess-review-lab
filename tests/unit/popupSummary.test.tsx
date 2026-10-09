import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PopupSummaryView } from "../../src/popup/Popup";
import type { ReviewSummary } from "../../src/popup/reviewSummary";

function completed(): ReviewSummary {
  const moves = Array.from({ length: 118 }, (_, index) => ({
    ply: index + 1, moveNumber: Math.floor(index / 2) + 1, color: (index % 2 ? "black" : "white") as "white" | "black",
    san: index === 116 ? "Kg1" : index === 117 ? "Qg2#" : `m${index + 1}`, displayClassification: "best" as const,
  }));
  return { analysisId: "analysis-123", status: "completed", currentPly: 118, totalPlies: 118, whiteName: "White Player", blackName: "Black Player", whiteAccuracy: 91.2, blackAccuracy: 88.4, moves };
}

describe("popup-first review summary", () => {
  it("renders real analysis progress without deep-review components", () => {
    render(<PopupSummaryView summary={{ ...completed(), status: "analyzing", currentPly: 57, currentDepth: 16, moves: [], whiteAccuracy: undefined, blackAccuracy: undefined }} onCancel={vi.fn()} onExit={vi.fn()} onDeep={vi.fn()}/>);
    expect(screen.getByText("Analyzing 57 / 118")).toBeInTheDocument(); expect(screen.getByText("depth=16 | Stockfish 18 NNUE")).toBeInTheDocument();
    expect(screen.queryByLabelText(/chessboard/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/evaluation graph/i)).not.toBeInTheDocument();
  });
  it("reports refinement as a meaningful phase instead of fake whole-game linear progress", () => {
    render(<PopupSummaryView summary={{ ...completed(), status: "analyzing", phase: "refinement", phaseCompleted: 7, phaseTotal: 19, currentDepth: 18, moves: [], whiteAccuracy: undefined, blackAccuracy: undefined }} onCancel={vi.fn()} onExit={vi.fn()} onDeep={vi.fn()}/>);
    expect(screen.getByText("Refining critical moves 7 / 19")).toBeInTheDocument();
    expect(screen.queryByText(/Analyzing 7 \/ 118/)).not.toBeInTheDocument();
  });
  it("renders final scores but leaves the move list to the main review page", () => {
    render(<PopupSummaryView summary={completed()} onCancel={vi.fn()} onExit={vi.fn()} onDeep={vi.fn()}/>);
    expect(screen.getByText("91.2")).toBeInTheDocument(); expect(screen.getByText("88.4")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Move classifications" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/chessboard/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/evaluation graph/i)).not.toBeInTheDocument();
  });
  it("shows Chess.com's brief rows first and every category after expanding", () => {
    const categories = ["brilliant", "great", "book", "best", "excellent", "good", "inaccuracy", "mistake", "miss", "blunder"] as const;
    const summary = completed();
    summary.moves = categories.flatMap((displayClassification, index) => ([
      { ply: index * 2 + 1, moveNumber: index + 1, color: "white" as const, san: `w${index + 1}`, displayClassification },
      { ply: index * 2 + 2, moveNumber: index + 1, color: "black" as const, san: `b${index + 1}`, displayClassification },
    ]));
    render(<PopupSummaryView summary={summary} onCancel={vi.fn()} onExit={vi.fn()} onDeep={vi.fn()}/>);
    const table = screen.getByRole("table", { name: "Classification summary" });
    expect(within(table).getByText("White Player")).toBeInTheDocument();
    expect(within(table).getByText("Black Player")).toBeInTheDocument();
    const rowKinds = () => Array.from(table.querySelectorAll("tr[data-classification]")).map((row) => row.getAttribute("data-classification"));
    // Brilliant appears in brief view only because it is non-zero here.
    expect(rowKinds()).toEqual(["brilliant", "great", "best", "excellent", "mistake", "miss", "blunder"]);
    fireEvent.click(screen.getByRole("button", { name: "Hiện chi tiết" }));
    expect(rowKinds()).toEqual([...categories]);
    for (const category of categories) {
      const row = table.querySelector(`tr[data-classification="${category}"]`) as HTMLElement;
      const cells = within(row).getAllByRole("cell");
      expect([cells[0].textContent, cells[2].textContent]).toEqual(["1", "1"]);
    }
    fireEvent.click(screen.getByRole("button", { name: "Hiện tóm tắt" }));
    expect(rowKinds()).toHaveLength(7);
  });
  it("hides Brilliant from the brief view when nobody has one", () => {
    render(<PopupSummaryView summary={completed()} onCancel={vi.fn()} onExit={vi.fn()} onDeep={vi.fn()}/>);
    const table = screen.getByRole("table", { name: "Classification summary" });
    expect(Array.from(table.querySelectorAll("tr[data-classification]")).map((row) => row.getAttribute("data-classification"))).toEqual(["great", "best", "excellent", "mistake", "miss", "blunder"]);
  });
  it("opens deep analysis using only the analysis identifier", () => {
    const onDeep = vi.fn(); render(<PopupSummaryView summary={completed()} onCancel={vi.fn()} onExit={vi.fn()} onDeep={onDeep}/>);
    fireEvent.click(screen.getByRole("button", { name: "Xem phân tích sâu" })); expect(onDeep).toHaveBeenCalledWith("analysis-123");
  });
  it("offers an explicit stop-and-exit action while analysis is active", () => {
    const onExit = vi.fn(); const onCancel = vi.fn();
    render(<PopupSummaryView summary={{ ...completed(), status: "analyzing" }} onCancel={onCancel} onExit={onExit} onDeep={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", { name: "Dừng và thoát" }));
    expect(onExit).toHaveBeenCalledOnce(); expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" })); expect(onCancel).toHaveBeenCalledOnce();
  });
  it("returns a completed summary to a ready state", () => {
    function ResetHarness() {
      const [summary, setSummary] = useState<ReviewSummary | null>(completed());
      return summary
        ? <PopupSummaryView summary={summary} onCancel={vi.fn()} onExit={() => setSummary(null)} onDeep={vi.fn()}/>
        : <p>Ready to analyze</p>;
    }
    render(<ResetHarness/>);
    fireEvent.click(screen.getByRole("button", { name: "Phân tích ván mới" }));
    expect(screen.getByText("Ready to analyze")).toBeInTheDocument();
  });
});
