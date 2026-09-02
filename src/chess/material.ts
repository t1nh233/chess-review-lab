import { Chess, type PieceSymbol } from "chess.js";

export const MATERIAL_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3.15, r: 5, q: 9, k: 0 };

export function materialBalance(fen: string): number {
  const chess = new Chess(fen);
  let balance = 0;
  for (const rank of chess.board()) for (const piece of rank) {
    if (piece) balance += (piece.color === "w" ? 1 : -1) * MATERIAL_VALUES[piece.type];
  }
  return balance;
}

export function moverMaterialDelta(before: string, after: string, color: "white" | "black"): number {
  const delta = materialBalance(after) - materialBalance(before);
  return color === "white" ? delta : -delta;
}
