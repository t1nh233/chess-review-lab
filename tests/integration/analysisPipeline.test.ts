import { Chess } from "chess.js";
import { describe, expect, it, vi } from "vitest";
import { analyzeGame } from "../../src/analysis/analyzeGame";
import { parsePgn } from "../../src/chess/pgn";
import type { ChessEngine, EngineAnalysisRequest, EngineAnalysisResult } from "../../src/engine/engineTypes";
import { CLEAN_GAME, DRAW } from "../fixtures/games";
import cleanFixture from "../fixtures/clean-game.pgn?raw";
import drawFixture from "../fixtures/draw.pgn?raw";
import ordinaryExchangeFixture from "../fixtures/ordinary-exchange.pgn?raw";

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
    expect(partialLengths).toEqual(Array.from({ length: game.moves.length }, (_, index) => index + 1));
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
    expect(engine.analyze.mock.calls.length).toBeLessThan(game.moves.length + 1);
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
    const game = parsePgn(`[SetUp "1"]\n[FEN "7k/8/8/8/8/8/8/K7 b - - 0 1"]\n[Result "*"]\n\n1... Kh7 *`);
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
