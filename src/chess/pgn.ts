import { Chess, type Color, type Move } from "chess.js";

export interface GameMove {
  ply: number;
  moveNumber: number;
  color: "white" | "black";
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
}

export interface ParsedGame {
  headers: Record<string, string>;
  moves: GameMove[];
  result?: string;
  whiteRating?: number;
  blackRating?: number;
  startingFen: string;
  pgn: string;
}

function colorName(color: Color): "white" | "black" { return color === "w" ? "white" : "black"; }
function toUci(move: Move): string { return `${move.from}${move.to}${move.promotion ?? ""}`; }
function rating(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePgn(pgn: string): ParsedGame {
  const trimmed = pgn.trim();
  if (!trimmed) throw new Error("Paste or choose a PGN before importing.");
  try {
    const game = new Chess();
    game.loadPgn(trimmed, { strict: false });
    const headers = game.getHeaders();
    const start = headers.SetUp === "1" && headers.FEN ? headers.FEN : new Chess().fen();
    const replay = new Chess(start);
    const moves: GameMove[] = [];
    for (const historical of game.history({ verbose: true })) {
      const fenBefore = replay.fen();
      const move = replay.move({ from: historical.from, to: historical.to, promotion: historical.promotion });
      if (!move) throw new Error("Move replay failed");
      moves.push({
        ply: moves.length + 1,
        moveNumber: Math.floor(moves.length / 2) + 1,
        color: colorName(move.color),
        san: move.san,
        uci: toUci(move),
        fenBefore,
        fenAfter: replay.fen(),
      });
    }
    if (!moves.length) throw new Error("The PGN does not contain any moves.");
    const result = headers.Result && headers.Result !== "*" ? headers.Result : undefined;
    return {
      headers: { ...headers }, moves, result,
      whiteRating: rating(headers.WhiteElo), blackRating: rating(headers.BlackElo),
      startingFen: start, pgn: trimmed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parser error";
    throw new Error(`This PGN could not be parsed. ${message}`);
  }
}

export function gameFingerprint(game: ParsedGame): string {
  let hash = 2166136261;
  const input = `${game.startingFen}|${game.moves.map((m) => m.uci).join(" ")}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
