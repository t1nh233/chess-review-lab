import { useMemo } from "react";

const PIECES: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
function fenSquares(fen: string): (string | null)[] {
  return fen.split(" ")[0].split("/").flatMap((rank) => [...rank].flatMap((char) => /\d/.test(char) ? Array(Number(char)).fill(null) : [char]));
}

function squareCenter(square: string, orientation: "white" | "black"): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return orientation === "white" ? [file + 0.5, 8 - rank + 0.5] : [7 - file + 0.5, rank - 0.5];
}

function BestMoveArrow({ move, orientation }: { move?: string; orientation: "white" | "black" }) {
  if (!move || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return null;
  const [x1, y1] = squareCenter(move.slice(0, 2), orientation);
  const [x2, y2] = squareCenter(move.slice(2, 4), orientation);
  return <svg className="best-move-arrow" viewBox="0 0 8 8" role="img" aria-label={`Best move ${move}`}>
    <defs><marker id="best-move-arrowhead" viewBox="0 0 1 1" refX="0.85" refY="0.5" markerWidth="0.75" markerHeight="0.75" orient="auto-start-reverse"><path d="M 0 0 L 1 0.5 L 0 1 z"/></marker></defs>
    <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#best-move-arrowhead)"/>
  </svg>;
}

export function ChessBoard({ fen, orientation, lastMove, bestMove }: { fen: string; orientation: "white" | "black"; lastMove?: string; bestMove?: string }) {
  const source = useMemo(() => fenSquares(fen), [fen]);
  const indexes = Array.from({ length: 64 }, (_, index) => orientation === "white" ? index : 63 - index);
  return <div className="board" role="grid" aria-label={`Chess position, ${orientation} at bottom`}>
    {indexes.map((sourceIndex) => {
      const rank = 8 - Math.floor(sourceIndex / 8); const file = "abcdefgh"[sourceIndex % 8]; const square = `${file}${rank}`;
      const highlighted = lastMove && (lastMove.slice(0, 2) === square || lastMove.slice(2, 4) === square);
      return <div role="gridcell" aria-label={`${square}${source[sourceIndex] ? ` ${source[sourceIndex]}` : " empty"}`} className={`square ${(Math.floor(sourceIndex / 8) + sourceIndex) % 2 ? "dark" : "light"} ${highlighted ? "last" : ""}`} key={square}>
        <span className="piece" aria-hidden="true">{source[sourceIndex] ? PIECES[source[sourceIndex]!] : ""}</span>
        {((orientation === "white" && file === "a") || (orientation === "black" && file === "h")) && <span className="rank-label">{rank}</span>}
        {((orientation === "white" && rank === 1) || (orientation === "black" && rank === 8)) && <span className="file-label">{file}</span>}
      </div>;
    })}
    <BestMoveArrow move={bestMove} orientation={orientation}/>
  </div>;
}
