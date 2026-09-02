import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChessBoard } from "../../src/components/ChessBoard";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("ChessBoard best-move arrow", () => {
  it("renders the arrow with white orientation coordinates", () => {
    render(<ChessBoard fen={START_FEN} orientation="white" bestMove="e2e4"/>);
    const line = screen.getByRole("img", { name: "Best move e2e4" }).querySelector("line");
    expect(line).toHaveAttribute("x1", "4.5");
    expect(line).toHaveAttribute("y1", "6.5");
    expect(line).toHaveAttribute("x2", "4.5");
    expect(line).toHaveAttribute("y2", "4.5");
  });

  it("rotates arrow coordinates with black orientation", () => {
    render(<ChessBoard fen={START_FEN} orientation="black" bestMove="e2e4"/>);
    const line = screen.getByRole("img", { name: "Best move e2e4" }).querySelector("line");
    expect(line).toHaveAttribute("x1", "3.5");
    expect(line).toHaveAttribute("y1", "1.5");
    expect(line).toHaveAttribute("x2", "3.5");
    expect(line).toHaveAttribute("y2", "3.5");
  });

  it("omits invalid or absent moves", () => {
    const { rerender } = render(<ChessBoard fen={START_FEN} orientation="white"/>);
    expect(screen.queryByRole("img", { name: /Best move/ })).not.toBeInTheDocument();
    rerender(<ChessBoard fen={START_FEN} orientation="white" bestMove="invalid"/>);
    expect(screen.queryByRole("img", { name: /Best move/ })).not.toBeInTheDocument();
  });
});
