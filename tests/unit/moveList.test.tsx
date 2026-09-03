import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameReview, MoveReview } from "../../src/analysis/analysisTypes";
import { parsePgn } from "../../src/chess/pgn";
import { AnalysisPanel } from "../../src/components/AnalysisPanel";
import { ChessBoard } from "../../src/components/ChessBoard";
import { MoveList } from "../../src/components/MoveList";
import { getReviewSelection } from "../../src/review/selection";

function reviewedMoves(pgn = "1. e4 e5 *"): { game: ReturnType<typeof parsePgn>; moves: MoveReview[] } {
  const game = parsePgn(pgn);
  const moves = game.moves.map((move) => ({
    ...move, evalBefore: { cp: 0 }, evalAfter: { cp: 0 }, expectedPointsBefore: 0.5, expectedPointsAfter: 0.5,
    expectedPointsLoss: 0, estimatedAccuracy: 100, accuracyWeight: 1, primaryClassification: "best" as const,
    tags: [], bestMove: move.uci, principalVariation: [move.uci], criticality: 0, explanation: "Selected move explanation.",
    continuationLines: [], analysisDepth: 12, analysisStatus: "final" as const,
    evidence: { expectedPointsBefore: 0.5, expectedPointsAfter: 0.5, expectedPointsLoss: 0, reasons: [] },
  }));
  return { game, moves };
}

function SelectionHarness() {
  const { game, moves } = reviewedMoves();
  const review = { game, moves } as GameReview;
  const [selectedPly, setSelectedPly] = useState(0);
  const selection = getReviewSelection(review, selectedPly);
  return <><MoveList moves={moves} selectedPly={selectedPly} onSelect={setSelectedPly}/><ChessBoard fen={selection.currentFen} orientation="white" lastMove={selection.selectedMove?.uci}/><AnalysisPanel move={selection.selectedMove}/></>;
}

describe("Deep Review full-move list", () => {
  it("renders same-number White and Black moves on one row without repeated notation", () => {
    const { moves } = reviewedMoves();
    render(<MoveList moves={moves} selectedPly={0} onSelect={vi.fn()}/>);
    const table = screen.getByRole("table", { name: "Analyzed moves" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("1");
    expect(within(rows[1]).getAllByRole("button")).toHaveLength(2);
    expect(within(rows[1]).queryByText("1.")).not.toBeInTheDocument();
    expect(within(rows[1]).queryByText("1...")).not.toBeInTheDocument();
  });

  it("selects White and Black cells independently and synchronizes board and analysis panel", () => {
    render(<SelectionHarness/>);
    fireEvent.click(screen.getByRole("button", { name: /Move 1 white, e4/ }));
    expect(screen.getByRole("gridcell", { name: "e4 P" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "e4" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Move 1 black, e5/ }));
    expect(screen.getByRole("gridcell", { name: "e5 p" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "e5" })).toBeInTheDocument();
  });

  it("renders 118 independently selectable cells in 59 rows through final 59 | Kg1 | Qg2#", () => {
    const { moves } = reviewedMoves("1. e4 e5 *");
    const longMoves = Array.from({ length: 118 }, (_, index) => ({ ...moves[index % 2], ply: index + 1, moveNumber: Math.floor(index / 2) + 1, color: (index % 2 ? "black" : "white") as "white" | "black", san: index === 116 ? "Kg1" : index === 117 ? "Qg2#" : `m${index + 1}` }));
    render(<MoveList moves={longMoves} selectedPly={0} onSelect={vi.fn()}/>);
    const table = screen.getByRole("table", { name: "Analyzed moves" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(60);
    expect(within(table).getAllByRole("button")).toHaveLength(118);
    expect(within(rows[59]).getByRole("rowheader")).toHaveTextContent("59");
    expect(within(rows[59]).getByText("Kg1")).toBeInTheDocument();
    expect(within(rows[59]).getByText("Qg2#")).toBeInTheDocument();
  });
});
