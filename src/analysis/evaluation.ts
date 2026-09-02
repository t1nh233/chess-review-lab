import type { EngineLine, NormalizedEval } from "../engine/engineTypes";

export function negateEval(value: NormalizedEval): NormalizedEval {
  return value.cp !== undefined ? { cp: -value.cp } : value.mate !== undefined ? { mate: -value.mate } : {};
}

export function lineEvaluationFromWhite(line: EngineLine | undefined, fen: string): NormalizedEval {
  if (!line) return {};
  const sideToMove = fen.split(" ")[1];
  const raw: NormalizedEval = line.scoreCp !== undefined ? { cp: line.scoreCp } : line.mate !== undefined ? { mate: line.mate } : {};
  return sideToMove === "b" ? negateEval(raw) : raw;
}

export function evalToCp(value: NormalizedEval): number {
  if (value.cp !== undefined) return value.cp;
  if (value.mate !== undefined) return Math.sign(value.mate) * (100_000 - Math.min(Math.abs(value.mate), 100) * 100);
  return 0;
}
