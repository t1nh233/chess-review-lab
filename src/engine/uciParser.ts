import type { EngineLine } from "./engineTypes";

export type ParsedInfo = EngineLine;

export function parseInfoLine(line: string): ParsedInfo | null {
  if (!line.startsWith("info ")) return null;
  const tokens = line.trim().split(/\s+/);
  const numberAfter = (key: string): number | undefined => {
    const index = tokens.indexOf(key);
    if (index < 0) return undefined;
    const value = Number(tokens[index + 1]);
    return Number.isFinite(value) ? value : undefined;
  };
  const depth = numberAfter("depth");
  const pvIndex = tokens.indexOf("pv");
  if (depth === undefined || pvIndex < 0) return null;
  const cpIndex = tokens.indexOf("cp");
  const mateIndex = tokens.indexOf("mate");
  return {
    multipv: numberAfter("multipv") ?? 1,
    depth,
    scoreCp: cpIndex >= 0 ? Number(tokens[cpIndex + 1]) : undefined,
    mate: mateIndex >= 0 ? Number(tokens[mateIndex + 1]) : undefined,
    nodes: numberAfter("nodes"),
    nps: numberAfter("nps"),
    moves: tokens.slice(pvIndex + 1),
  };
}

export function parseBestMove(line: string): string | null {
  const match = /^bestmove\s+(\S+)/.exec(line);
  return match?.[1] && match[1] !== "(none)" ? match[1] : null;
}
