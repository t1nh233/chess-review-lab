import { fireEvent, render, screen, within } from "@testing-library/react";
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
    render(<PopupSummaryView summary={{ ...completed(), status: "analyzing", currentPly: 57, currentDepth: 16, moves: [], whiteAccuracy: undefined, blackAccuracy: undefined }} onCancel={vi.fn()} onDeep={vi.fn()}/>);
    expect(screen.getByText("Analyzing 57 / 118")).toBeInTheDocument(); expect(screen.getByText("depth=16 | Stockfish 18 Lite")).toBeInTheDocument();
    expect(screen.queryByLabelText(/chessboard/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/evaluation graph/i)).not.toBeInTheDocument();
  });
  it("reports refinement as a meaningful phase instead of fake whole-game linear progress", () => {
    render(<PopupSummaryView summary={{ ...completed(), status: "analyzing", phase: "refinement", phaseCompleted: 7, phaseTotal: 19, currentDepth: 18, moves: [], whiteAccuracy: undefined, blackAccuracy: undefined }} onCancel={vi.fn()} onDeep={vi.fn()}/>);
    expect(screen.getByText("Refining critical moves 7 / 19")).toBeInTheDocument();
    expect(screen.queryByText(/Analyzing 7 \/ 118/)).not.toBeInTheDocument();
  });
  it("renders final scores and 59 grouped full-move rows with 118 move cells", () => {
    render(<PopupSummaryView summary={completed()} onCancel={vi.fn()} onDeep={vi.fn()}/>);
    expect(screen.getByText("91.2")).toBeInTheDocument(); expect(screen.getByText("88.4")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Move classifications" });
    expect(within(table).getAllByRole("row")).toHaveLength(60); expect(within(table).getAllByRole("cell")).toHaveLength(118);
    const finalRow = within(table).getAllByRole("row")[59]; expect(within(finalRow).getByText("59")).toBeInTheDocument(); expect(within(finalRow).getByText("Kg1")).toBeInTheDocument(); expect(within(finalRow).getByText("Qg2#")).toBeInTheDocument();
    expect(screen.queryByLabelText(/chessboard/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/evaluation graph/i)).not.toBeInTheDocument();
  });
  it("renders a shared six-row White/Black classification summary with correct counts", () => {
    const categories = ["brilliant", "great", "best", "mistake", "miss", "blunder"] as const;
    const summary = completed();
    summary.moves = categories.flatMap((displayClassification, index) => ([
      { ply: index * 2 + 1, moveNumber: index + 1, color: "white" as const, san: `w${index + 1}`, displayClassification },
      { ply: index * 2 + 2, moveNumber: index + 1, color: "black" as const, san: `b${index + 1}`, displayClassification },
    ]));
    render(<PopupSummaryView summary={summary} onCancel={vi.fn()} onDeep={vi.fn()}/>);
    const table = screen.getByRole("table", { name: "Classification summary" });
    expect(within(table).getAllByRole("row")).toHaveLength(8);
    expect(within(table).getByText("White Player")).toBeInTheDocument();
    expect(within(table).getByText("Black Player")).toBeInTheDocument();
    for (const category of categories) {
      const row = table.querySelector(`tr[data-classification="${category}"]`);
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["1", "1"]);
    }
  });
  it("opens deep analysis using only the analysis identifier", () => {
    const onDeep = vi.fn(); render(<PopupSummaryView summary={completed()} onCancel={vi.fn()} onDeep={onDeep}/>);
    fireEvent.click(screen.getByRole("button", { name: "Xem phân tích sâu" })); expect(onDeep).toHaveBeenCalledWith("analysis-123");
  });
});
