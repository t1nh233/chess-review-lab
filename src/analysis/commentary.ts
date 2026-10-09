import { Chess } from "chess.js";
import type { MoveReview } from "./analysisTypes";
import type { NormalizedEval } from "../engine/engineTypes";
import { toDisplayClassification, type DisplayClassification } from "../popup/displayClassification";

export interface MoveCommentary {
  tone: DisplayClassification;
  /** One sentence naming the move and its verdict, in the style of Chess.com's Game Review. */
  headline: string;
  /** Present for inaccuracy / mistake / miss / blunder when the engine preferred another move. */
  advice?: { san: string; uci: string; text: string };
  /** Evaluation swing and mate warnings, for flagged moves only. */
  detail?: string;
  /** True when the move is worth the player's attention. */
  flagged: boolean;
}

const VERDICT: Record<DisplayClassification, string> = {
  brilliant: "là một nước đi Thiên tài",
  great: "là một nước đi Tuyệt",
  book: "là nước đi trong khai cuộc",
  best: "là nước đi tốt nhất",
  excellent: "là một nước đi Tuyệt vời",
  good: "là một nước đi Tốt",
  inaccuracy: "là một nước đi không chính xác",
  mistake: "là một sai lầm",
  miss: "bỏ lỡ cơ hội",
  blunder: "là một nước sai lầm ngớ ngẩn",
};
const FLAGGED = new Set<DisplayClassification>(["inaccuracy", "mistake", "miss", "blunder"]);

export function uciToSan(fen: string, uci?: string): string | undefined {
  if (!uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return undefined;
  try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san; } catch { return undefined; }
}

export function formatEval(value: NormalizedEval): string {
  if (value.mate !== undefined) return `${value.mate > 0 ? "+" : "-"}M${Math.abs(value.mate)}`;
  const pawns = (value.cp ?? 0) / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

export function describeMove(move: MoveReview): MoveCommentary {
  const tone = toDisplayClassification(move);
  const flagged = FLAGGED.has(tone);
  const headline = `${move.san} ${VERDICT[tone]}`;
  if (!flagged) return { tone, headline: `${headline}.`, flagged };
  const bestSan = move.bestMove && move.bestMove !== move.uci ? uciToSan(move.fenBefore, move.bestMove) : undefined;
  const parts = [`Đánh giá ${formatEval(move.evalBefore)} → ${formatEval(move.evalAfter)}`];
  if (move.evidence?.mateState?.transition === "allowed") parts.push("nước này để đối thủ chiếu hết");
  if (tone === "miss") parts.push("đối thủ vừa mắc lỗi nhưng cơ hội đã không được tận dụng");
  return {
    tone, flagged,
    headline: `${headline}.`,
    advice: bestSan ? { san: bestSan, uci: move.bestMove!, text: `Nước tốt hơn là ${bestSan}` } : undefined,
    detail: `${parts.join(" · ")}.`,
  };
}
