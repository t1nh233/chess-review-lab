import type { GameReview, MoveReview, PrimaryClassification } from "../analysis/analysisTypes";

export type PgnExportKind = "clean" | "analysis";
const NAGS: Partial<Record<PrimaryClassification, string>> = { best: "$1", excellent: "$1", great: "$3", brilliant: "$3", mistake: "$2", blunder: "$4", inaccuracy: "$6" };

function escapeHeader(value: string): string { return value.replace(/[\r\n\0]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
function safeComment(value: string): string { return value.replace(/[{}\r\n\0]/g, " ").replace(/\s+/g, " ").trim(); }
function evaluation(move: MoveReview): string { return move.evalAfter.mate !== undefined ? `#${move.evalAfter.mate}` : ((move.evalAfter.cp ?? 0) / 100).toFixed(2); }
function annotation(move: MoveReview): string {
  const fields = [`[%eval ${evaluation(move)}]`, `[%depth ${move.analysisDepth}]`, `[%crl_class ${move.primaryClassification[0].toUpperCase()}${move.primaryClassification.slice(1)}]`, `[%crl_accuracy ${move.estimatedAccuracy.toFixed(1)}]`, `[%crl_ep_before ${move.expectedPointsBefore.toFixed(3)}]`, `[%crl_ep_after ${move.expectedPointsAfter.toFixed(3)}]`];
  if (move.bestMove) fields.push(`Best: ${safeComment(move.bestMove)}`);
  if (move.principalVariation.length) fields.push(`PV: ${safeComment(move.principalVariation.slice(0, 12).join(" "))}`);
  return `{ ${fields.join(" ")} }`;
}
function serializeHeaders(headers: Record<string, string>): string { return Object.entries(headers).map(([name, value]) => `[${name} "${escapeHeader(value)}"]`).join("\n"); }

export function exportCleanPgn(review: GameReview): string { return review.game.pgn.trim(); }
export function exportAnalysisPgn(review: GameReview): string {
  const depth = Math.max(0, ...review.moves.map((move) => move.analysisDepth));
  const headers = { ...review.game.headers, Annotator: "Chess Review Lab", AnalysisEngine: "Stockfish 18 Lite", AnalysisDepth: String(depth), CRLEngineVersion: review.engineVersion, CRLClassifierVersion: review.classifierVersion, CRLExpectedPointsModelVersion: review.expectedPointsModelVersion, CRLAnalysisModelVersion: review.analysisModelVersion };
  const tokens: string[] = [];
  review.moves.forEach((move) => {
    if (move.color === "white") tokens.push(`${move.moveNumber}.`);
    else tokens.push(`${move.moveNumber}...`);
    tokens.push(move.san);
    const nag = NAGS[move.primaryClassification]; if (nag) tokens.push(nag);
    tokens.push(annotation(move));
  });
  tokens.push(review.game.headers.Result ?? review.game.result ?? "*");
  return `${serializeHeaders(headers)}\n\n${tokens.join(" ")}\n`;
}
function slug(value: string): string {
  const printable = [...value.normalize("NFKD")].map((character) => character.charCodeAt(0) < 32 ? "-" : character).join("");
  const cleaned = printable.replace(/[<>:"/\\|?*]/g, "-").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/[-_.]{2,}/g, "-").replace(/^[-_.]+|[-_.]+$/g, "").toLowerCase();
  return cleaned || "game";
}
export function pgnFilename(review: GameReview, kind: PgnExportKind): string {
  const white = slug(review.game.headers.White ?? "white"); const black = slug(review.game.headers.Black ?? "black");
  const date = slug((review.game.headers.Date ?? review.game.headers.UTCDate ?? "undated").replaceAll(".", "-"));
  return `${white}-vs-${black}-${date}-${kind}.pgn`;
}
export async function copyPgn(text: string, clipboard: Pick<Clipboard, "writeText"> = navigator.clipboard): Promise<void> { await clipboard.writeText(text); }
export function downloadPgn(review: GameReview, kind: PgnExportKind, documentRef: Document = document): string {
  const text = kind === "clean" ? exportCleanPgn(review) : exportAnalysisPgn(review); const filename = pgnFilename(review, kind);
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-chess-pgn;charset=utf-8" }));
  const anchor = documentRef.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url)); return filename;
}
