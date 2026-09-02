import { Chess } from "chess.js";
import { describe, expect, it, vi } from "vitest";
import type { GameReview, MoveTag, PrimaryClassification } from "../../src/analysis/analysisTypes";
import { copyPgn, downloadPgn, exportAnalysisPgn, exportCleanPgn, pgnFilename } from "../../src/chess/pgnExport";
import { parsePgn } from "../../src/chess/pgn";
import cleanPgn from "../fixtures/clean-game.pgn?raw";
import finalMatePgn from "../fixtures/final-mate-59.pgn?raw";
import chessComReference from "../fixtures/chesscom-low-rating-001.pgn?raw";

function reviewFor(pgn: string, classification: PrimaryClassification = "mistake"): GameReview {
  const game = parsePgn(pgn);
  const moves = game.moves.map((move) => ({
    ...move, evalBefore: { cp: 0 }, evalAfter: move.san.endsWith("#") ? { mate: move.color === "white" ? 1 : -1 } : { cp: 208 },
    expectedPointsBefore: .82, expectedPointsAfter: .8, expectedPointsLoss: .02, estimatedAccuracy: 96.4, accuracyWeight: 1,
    primaryClassification: classification, tags: (move.san.endsWith("#") ? ["mate", "game_ending"] : []) as MoveTag[],
    bestMove: move.uci, principalVariation: [move.uci], continuationLines: [], criticality: .5, explanation: "Evidence.",
    analysisDepth: 20, analysisStatus: "final" as const,
    evidence: { expectedPointsBefore: .82, expectedPointsAfter: .8, expectedPointsLoss: .02, reasons: [] },
  }));
  return { game, moves, positions: [], whiteAccuracy: 96.4, blackAccuracy: 96.4, summary: { headline: "", counts: { white: { brilliant:0,great:0,best:0,excellent:0,good:0,inaccuracy:0,mistake:0,blunder:0 }, black: { brilliant:0,great:0,best:0,excellent:0,good:0,inaccuracy:0,mistake:0,blunder:0 } }, criticalPlies: [], specialPlies: [] }, engineVersion: "Stockfish 18.0.8 lite-single", enginePreset: "balanced", analysisModelVersion: "1", expectedPointsModelVersion: "ep-1", classifierVersion: "class-1", classifierMode: "compatibility" };
}

describe("PGN export", () => {
  it("returns the immutable source as clean PGN", () => {
    const review = reviewFor(cleanPgn);
    expect(exportCleanPgn(review)).toBe(review.game.pgn);
  });

  it("serializes project headers, NAG, evaluation, depth, classification, accuracy and PV", () => {
    const review = reviewFor(cleanPgn);
    review.game.headers.Custom = 'quote " and slash \\ and\nline';
    const output = exportAnalysisPgn(review);
    expect(output).toContain('[Annotator "Chess Review Lab"]');
    expect(output).toContain('[AnalysisDepth "20"]');
    expect(output).toContain('[Custom "quote \\" and slash \\\\ and line"]');
    expect(output).toContain("$2 { [%eval 2.08] [%depth 20] [%crl_class Mistake] [%crl_accuracy 96.4]");
    expect(output).toContain("Best: e2e4 PV: e2e4");
  });

  it("round trips the complete mainline, result and final position", () => {
    const source = parsePgn(cleanPgn); const exported = parsePgn(exportAnalysisPgn(reviewFor(cleanPgn)));
    expect(exported.moves.map((move) => move.san)).toEqual(source.moves.map((move) => move.san));
    expect(exported.result).toBe(source.result);
    expect(exported.moves.at(-1)?.fenAfter).toBe(source.moves.at(-1)?.fenAfter);
  });

  it("preserves a final Black 59...Qg2# terminal move", () => {
    const review = reviewFor(finalMatePgn, "best"); const output = exportAnalysisPgn(review); const parsed = parsePgn(output);
    expect(output).toContain("59... Qg2#");
    expect(parsed.moves).toHaveLength(1);
    expect(parsed.moves[0]).toMatchObject({ moveNumber: 59, color: "black", san: "Qg2#" });
    expect(new Chess(parsed.moves[0].fenAfter).isCheckmate()).toBe(true);
  });

  it("round trips the 118-ply Chess.com reference through 59...Qg2#", () => {
    const source = parsePgn(chessComReference); const output = exportAnalysisPgn(reviewFor(chessComReference)); const parsed = parsePgn(output);
    expect(source.moves).toHaveLength(118); expect(output).toContain("59... Qg2#");
    expect(parsed.moves.map((move) => move.san)).toEqual(source.moves.map((move) => move.san));
    expect(parsed.moves.at(-1)?.fenAfter).toBe(source.moves.at(-1)?.fenAfter);
  });

  it("creates safe useful filenames and copies the exact payload", async () => {
    const review = reviewFor(cleanPgn); review.game.headers.White = "A/B:*?"; review.game.headers.Black = "Black";
    expect(pgnFilename(review, "analysis")).toMatch(/^a-b-vs-black-.*-analysis\.pgn$/);
    const writeText = vi.fn(async () => undefined); await copyPgn("payload", { writeText });
    expect(writeText).toHaveBeenCalledWith("payload");
  });

  it("creates a local PGN download with the sanitized filename", async () => {
    const review = reviewFor(cleanPgn); const click = vi.fn(); const anchor = { href: "", download: "", click };
    const createObjectURL = vi.fn(() => "blob:review"); const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const filename = downloadPgn(review, "analysis", { createElement: () => anchor } as unknown as Document);
    expect(filename).toMatch(/-analysis\.pgn$/); expect(anchor).toMatchObject({ href: "blob:review", download: filename }); expect(click).toHaveBeenCalledOnce();
    await Promise.resolve(); expect(revokeObjectURL).toHaveBeenCalledWith("blob:review");
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL; delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });
});
