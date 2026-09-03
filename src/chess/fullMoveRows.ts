export interface GroupableMove {
  moveNumber: number;
  color: "white" | "black";
}

export interface FullMoveRow<T extends GroupableMove> {
  moveNumber: number;
  white?: T;
  black?: T;
}

export function groupMovesByNumber<T extends GroupableMove>(moves: readonly T[]): FullMoveRow<T>[] {
  const rows = new Map<number, FullMoveRow<T>>();
  for (const move of moves) {
    const row = rows.get(move.moveNumber) ?? { moveNumber: move.moveNumber };
    row[move.color] = move;
    rows.set(move.moveNumber, row);
  }
  return [...rows.values()].sort((a, b) => a.moveNumber - b.moveNumber);
}
