import { Chess } from "chess.js";
import { describe, expect, it, vi } from "vitest";
import { analyzeGame } from "../../src/analysis/analyzeGame";
import { parsePgn } from "../../src/chess/pgn";
import type { ChessEngine, EngineAnalysisRequest, EngineAnalysisResult } from "../../src/engine/engineTypes";
import { CLEAN_GAME, DRAW } from "../fixtures/games";
import cleanFixture from "../fixtures/clean-game.pgn?raw";
import drawFixture from "../fixtures/draw.pgn?raw";
import ordinaryExchangeFixture from "../fixtures/ordinary-exchange.pgn?raw";
import finalMateFixture from "../fixtures/final-mate-59.pgn?raw";

function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

class DeterministicEngine implements ChessEngine {
  initialize = vi.fn(async () => undefined);
  analyze = vi.fn(async (request: EngineAnalysisRequest): Promise<EngineAnalysisResult> => {
    const legal = new Chess(request.fen).moves({ verbose: true }).slice(0, request.multiPv ?? 1);
    return {
      bestMove: toUci(legal[0]),
      depth: request.depth ?? 1,
      lines: legal.map((move, index) => ({ multipv: index + 1, depth: request.depth ?? 1, scoreCp: -index * 20, moves: [toUci(move)] })),
    };
  });
  stop = vi.fn(async () => undefined);
  dispose = vi.fn();
}

describe("analysis pipeline", () => {
  it("turns PGN and engine output into incremental serializable reviews", async () => {
    const game = parsePgn(CLEAN_GAME);
    const engine = new DeterministicEngine();
    const progress: Array<[number, number]> = [];
    const partialLengths: number[] = [];
    const review = await analyzeGame(game, engine, {
      safetyState: "SAFE_IMPORTED_PGN",
      preset: "quick",
      onProgress: (done, total) => progress.push([done, total]),
      onPartialReview: (partial) => partialLengths.push(partial.moves.length),
    });

    expect(engine.initialize).toHaveBeenCalledWith("SAFE_IMPORTED_PGN");
    expect(review.positions).toHaveLength(game.moves.length + 1);
    expect(review.moves).toHaveLength(game.moves.length);
    expect(progress).toEqual(Array.from({ length: game.moves.length + 1 }, (_, index) => [index + 1, game.moves.length + 1]));
    expect(partialLengths.slice(0, game.moves.length)).toEqual(Array.from({ length: game.moves.length }, (_, index) => index + 1));
    expect(review.moves[0].evidence).toMatchObject({
      expectedPointsBefore: expect.any(Number),
      expectedPointsAfter: expect.any(Number),
      expectedPointsLoss: expect.any(Number),
      reasons: expect.any(Array),
    });
    expect(() => JSON.stringify(review)).not.toThrow();
    expect(review.summary.largestMistakePly).toBeGreaterThan(0);
  });

  it("does not repeat engine work for a repeated FEN", async () => {
    const game = parsePgn(DRAW);
    game.moves[game.moves.length - 1].fenAfter = game.moves[0].fenBefore;
    const engine = new DeterministicEngine();
    await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "quick" });
    const callsByConfiguration = new Map<string, Set<string>>();
    for (const [request] of engine.analyze.mock.calls) {
      const key = `${request.depth}|${request.multiPv}`;
      const fens = callsByConfiguration.get(key) ?? new Set<string>();
      expect(fens.has(request.fen)).toBe(false);
      fens.add(request.fen); callsByConfiguration.set(key, fens);
    }
  });

  it("uses MultiPV1 for the default primary passes and only selective expansion", async () => {
    const game = parsePgn(CLEAN_GAME); const engine = new DeterministicEngine();
    await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "quick" });
    const calls = engine.analyze.mock.calls.map(([request]) => request);
    expect(calls.filter((request) => request.multiPv === 1)).toHaveLength(game.moves.length + 1);
    expect(calls.filter((request) => request.multiPv === 3).length).toBeLessThan(game.moves.length + 1);
  });

  it("prioritizes the selected position during refinement", async () => {
    const game = parsePgn(CLEAN_GAME); const engine = new DeterministicEngine(); let priority = 0;
    engine.analyze.mockImplementation(async (request) => {
      if (request.depth === 12) {
        request.onProgress?.({ positionIndex: request.positionIndex ?? 0, currentDepth: 9, targetDepth: 12, multipv: 1, bestMove: "a2a3", scoreCp: 0 });
        request.onProgress?.({ positionIndex: request.positionIndex ?? 0, currentDepth: 12, targetDepth: 12, multipv: 1, bestMove: "a2a4", scoreCp: 0 });
      }
      if (request.depth === 16) priority = game.moves.length;
      const legal = new Chess(request.fen).moves({ verbose: true }).slice(0, request.multiPv ?? 1);
      return { bestMove: toUci(legal[0]), depth: request.depth ?? 1, lines: legal.map((move, index) => ({ multipv: index + 1, depth: request.depth ?? 1, scoreCp: 0, moves: [toUci(move)] })) };
    });
    await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "quick", getPriorityPosition: () => priority });
    const finalCalls = engine.analyze.mock.calls.map(([request]) => request).filter((request) => request.depth === 16 && request.multiPv === 1);
    expect(finalCalls[0].positionIndex).toBe(0);
    expect(finalCalls[1].positionIndex).toBe(game.moves.length);
  });

  it("gives a tactical Great candidate selective MultiPV evidence", async () => {
    const game = parsePgn("1. e4 d5 2. exd5 *");
    const engine = new DeterministicEngine();
    const moveByFen = new Map(game.moves.map((move) => [move.fenBefore, move.uci]));
    engine.analyze.mockImplementation(async (request) => {
      const legal = new Chess(request.fen).moves({ verbose: true }).slice(0, request.multiPv ?? 1);
      const bestMove = moveByFen.get(request.fen) ?? toUci(legal[0]);
      const scoreCp = request.fen === game.moves[2].fenBefore ? 0 : request.fen === game.moves[2].fenAfter ? -300 : 0;
      return { bestMove, depth: request.depth ?? 1, lines: legal.map((move, index) => ({ multipv: index + 1, depth: request.depth ?? 1, scoreCp: scoreCp - index * 100, moves: [index === 0 ? bestMove : toUci(move)] })) };
    });
    await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "balanced" });
    expect(engine.analyze.mock.calls.some(([request]) => request.positionIndex === 2 && request.multiPv === 3)).toBe(true);
  });

  it("never requests MultiPV3 when the position has only one legal move", async () => {
    const game = parsePgn('[SetUp "1"]\n[FEN "k7/8/2K5/8/8/8/8/R7 b - - 0 1"]\n[Result "*"]\n\n1... Kb8 *');
    expect(new Chess(game.moves[0].fenBefore).moves()).toHaveLength(1);
    const engine = new DeterministicEngine();
    await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "deep" });
    expect(engine.analyze.mock.calls.some(([request]) => request.multiPv === 3)).toBe(false);
  });

  it("completes the popup-stable review without waiting for optional lazy continuations", async () => {
    const game = parsePgn(CLEAN_GAME); const engine = new DeterministicEngine();
    const phases: string[] = []; let report: import("../../src/analysis/analysisPerformance").AnalysisPerformanceReport | undefined;
    const review = await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "deep", onPhase: (phase) => phases.push(phase), onPerformanceReport: (value) => { report = value; } });
    expect(review.moves.every((move) => move.analysisStatus === "final")).toBe(true);
    expect(report).toMatchObject({ optionalDeepAnalysisMs: 0, baseOnlyPositionCount: game.moves.length + 1 });
    expect(phases.at(-1)).toBe("finalizing");
  });

  it("preserves the final Black checkmate ply without searching the terminal position", async () => {
    const game = parsePgn(finalMateFixture); const engine = new DeterministicEngine();
    const review = await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "quick" });
    expect(review.moves[0]).toMatchObject({ moveNumber: 59, color: "black", san: "Qg2#" });
    expect(review.moves[0].tags).toEqual(expect.arrayContaining(["mate", "game_ending"]));
    expect(engine.analyze.mock.calls.every(([request]) => request.fen !== game.moves[0].fenAfter)).toBe(true);
  });

  it("passes cancellation to the active engine request", async () => {
    const game = parsePgn(CLEAN_GAME);
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const engine = new DeterministicEngine();
    engine.analyze.mockImplementation((_request: EngineAnalysisRequest, signal?: AbortSignal): Promise<EngineAnalysisResult> => new Promise((_resolve, reject) => {
      observedSignal = signal;
      signal?.addEventListener("abort", () => reject(new DOMException("Analysis was cancelled.", "AbortError")), { once: true });
    }));
    const pending = analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "quick", signal: controller.signal });
    await vi.waitFor(() => expect(observedSignal).toBe(controller.signal));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("classifies a Black move from Black's perspective", async () => {
    const game = parsePgn(`[SetUp "1"]\n[FEN "7k/8/8/8/8/8/P7/K7 b - - 0 1"]\n[Result "*"]\n\n1... Kh7 *`);
    const engine = new DeterministicEngine();
    engine.analyze.mockImplementation(async (request): Promise<EngineAnalysisResult> => ({
      bestMove: request.fen.includes(" b ") ? "h8g8" : "a1b1",
      depth: 14,
      lines: [{ multipv: 1, depth: 14, scoreCp: 200, moves: [request.fen.includes(" b ") ? "h8g8" : "a1b1"] }],
    }));
    const review = await analyzeGame(game, engine, { safetyState: "SAFE_IMPORTED_PGN", preset: "quick" });
    expect(review.moves[0].evalBefore).toEqual({ cp: -200 });
    expect(review.moves[0].evalAfter).toEqual({ cp: 200 });
    expect(review.moves[0].expectedPointsBefore).toBeGreaterThan(0.5);
    expect(review.moves[0].expectedPointsAfter).toBeLessThan(0.5);
    expect(review.moves[0].primaryClassification).toBe("blunder");
  });

  it.each([
    ["clean", cleanFixture],
    ["draw", drawFixture],
    ["ordinary exchange", ordinaryExchangeFixture],
  ])("does not create special false positives for the %s fixture with neutral engine evidence", async (_name, pgn) => {
    const review = await analyzeGame(parsePgn(pgn), new DeterministicEngine(), { safetyState: "SAFE_IMPORTED_PGN", preset: "quick" });
    expect(review.moves.some((move) => move.primaryClassification === "great" || move.primaryClassification === "brilliant")).toBe(false);
    expect(review.moves.some((move) => move.tags.includes("missed_opportunity"))).toBe(false);
  });
});
