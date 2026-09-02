import { Chess } from "chess.js";
import type { ParsedGame } from "../chess/pgn";
import { materialBalance, moverMaterialDelta } from "../chess/material";
import { ANALYSIS_MODEL_VERSION, CLASSIFIER_VERSION, ENGINE_VERSION, EXPECTED_POINTS_MODEL_VERSION } from "../config/versions";
import type { ChessEngine, EngineAnalysisResult, NormalizedEval } from "../engine/engineTypes";
import type { GameSafetyState } from "../safety/liveGameGuard";
import { assertAnalysisAllowed } from "../safety/liveGameGuard";
import { moveAccuracy, gameAccuracy } from "./accuracy";
import type { GameReview, MoveReview, PositionReview, PrimaryClassification } from "./analysisTypes";
import { detectBrilliantMove } from "./brilliant";
import { calculateCriticality } from "./criticalMoments";
import { lineEvaluationFromWhite, evalToCp } from "./evaluation";
import { explainMove } from "./explanation";
import { moverExpectedPoints } from "./expectedPoints";
import { detectGreatMove } from "./greatMove";
import { detectMissedOpportunity } from "./missedOpportunity";
import { classifyMove } from "./moveClassifier";

export const ENGINE_PRESETS = {
  quick: { label: "Quick", depth: 14, multiPv: 2 },
  balanced: { label: "Balanced", depth: 18, multiPv: 3 },
  deep: { label: "Deep", depth: 22, multiPv: 3 },
} as const;
export type EnginePresetName = keyof typeof ENGINE_PRESETS;

export interface AnalyzeGameOptions {
  safetyState: GameSafetyState; preset: EnginePresetName; signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  onPartialReview?: (review: GameReview) => void;
  compatibilityClassifier?: boolean;
}

function moverCp(evaluation: NormalizedEval, color: "white" | "black"): number {
  const cp = evalToCp(evaluation);
  return color === "white" ? cp : -cp;
}

function pvSacrifice(beforeFen: string, afterFen: string, pv: string[], color: "white" | "black"): { sacrifice: number; deficitPlies: number } {
  const initial = materialBalance(beforeFen) * (color === "white" ? 1 : -1);
  const chess = new Chess(afterFen);
  let maxSacrifice = Math.max(0, initial - materialBalance(afterFen) * (color === "white" ? 1 : -1));
  let deficitPlies = 0;
  for (const uci of pv.slice(0, 6)) {
    try { chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { break; }
    const sacrifice = initial - materialBalance(chess.fen()) * (color === "white" ? 1 : -1);
    if (sacrifice >= 1.5) deficitPlies += 1;
    maxSacrifice = Math.max(maxSacrifice, sacrifice);
  }
  return { sacrifice: maxSacrifice, deficitPlies };
}

function emptyCounts(): Record<PrimaryClassification, number> {
  return { brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
}

function buildMoveReview(
  game: ParsedGame,
  positions: PositionReview[],
  moves: MoveReview[],
  index: number,
  options: AnalyzeGameOptions,
): MoveReview {
  const move = game.moves[index];
  const before = positions[index];
  const after = positions[index + 1];
  const rating = move.color === "white" ? game.whiteRating : game.blackRating;
  const epBefore = moverExpectedPoints(before.evaluation.white, move.color, rating);
  const epAfter = moverExpectedPoints(after.evaluation.white, move.color, rating);
  const epLoss = Math.max(0, epBefore - epAfter < 0.002 ? 0 : epBefore - epAfter);
  const engineRankIndex = before.lines.findIndex((line) => line.moves[0] === move.uci);
  const engineRank = engineRankIndex >= 0 ? engineRankIndex + 1 : undefined;
  const playedCandidateEval = engineRankIndex >= 0 ? lineEvaluationFromWhite(before.lines[engineRankIndex], move.fenBefore) : after.evaluation.white;
  const evalLossCp = Math.max(0, moverCp(before.evaluation.white, move.color) - moverCp(playedCandidateEval, move.color));
  const secondEval = before.lines[1] ? lineEvaluationFromWhite(before.lines[1], move.fenBefore) : before.evaluation.white;
  const secondEp = moverExpectedPoints(secondEval, move.color, rating);
  const uniquenessGap = Math.max(0, epBefore - secondEp);
  const criticality = calculateCriticality(epBefore, uniquenessGap, epLoss);
  const immediateMaterial = moverMaterialDelta(move.fenBefore, move.fenAfter, move.color);
  const legalMoveCount = new Chess(move.fenBefore).moves().length;
  const nearBest = move.uci === before.bestMove || (engineRank !== undefined && evalLossCp <= 45);
  const sacrifice = pvSacrifice(move.fenBefore, move.fenAfter, after.lines[0]?.moves ?? [], move.color);
  const great = detectGreatMove({ isNearBest: nearBest, uniquenessGap, outcomeSwing: Math.abs(epAfter - 0.5) - Math.abs(epBefore - 0.5), materialChange: immediateMaterial, legalMoveCount });
  const brilliant = detectBrilliantMove({
    isNearBest: nearBest, materialSacrifice: sacrifice.sacrifice, evalLossCp,
    moverEvalCpAfter: moverCp(after.evaluation.white, move.color), moverEvalCpBefore: moverCp(before.evaluation.white, move.color),
    pvMaterialDeficitPlies: sacrifice.deficitPlies, forcedRecapture: legalMoveCount <= 2,
    tacticallyMeaningful: uniquenessGap >= 0.05 || (after.lines[0]?.moves.length ?? 0) >= 3,
  });
  let primary = classifyMove({ epLoss, playedMove: move.uci, bestMove: before.bestMove, engineRank, evalLossCp, allowEquivalentBest: options.compatibilityClassifier !== false });
  if (great.matched) primary = "great";
  if (brilliant.matched) primary = "brilliant";
  const tags: MoveReview["tags"] = [];
  if (index > 0 && detectMissedOpportunity(moves[index - 1].expectedPointsLoss, epLoss)) tags.push("missed_opportunity");
  if (uniquenessGap >= 0.12 && nearBest) tags.push("only_move");
  if (legalMoveCount === 1) tags.push("forced");
  if (sacrifice.sacrifice >= 1.8) tags.push("sacrifice");
  if (after.evaluation.white.mate !== undefined) tags.push("mate");
  const accuracy = moveAccuracy(epLoss, criticality);
  return {
    ...move, evalBefore: before.evaluation.white, evalAfter: after.evaluation.white,
    expectedPointsBefore: epBefore, expectedPointsAfter: epAfter, expectedPointsLoss: epLoss,
    estimatedAccuracy: accuracy.raw, accuracyWeight: accuracy.weight, primaryClassification: primary, tags,
    bestMove: before.bestMove, principalVariation: before.lines[0]?.moves ?? [], criticality,
    explanation: explainMove(primary, tags),
    evidence: { expectedPointsBefore: epBefore, expectedPointsAfter: epAfter, expectedPointsLoss: epLoss, engineRank, evalLossCp, bestVsSecondGap: uniquenessGap, materialDelta: immediateMaterial, reasons: [...brilliant.reasons, ...great.reasons] },
  };
}

function buildGameReview(game: ParsedGame, moves: MoveReview[], positions: PositionReview[], options: AnalyzeGameOptions): GameReview {
  const whiteMoves = moves.filter((move) => move.color === "white");
  const blackMoves = moves.filter((move) => move.color === "black");
  const counts = { white: emptyCounts(), black: emptyCounts() };
  for (const move of moves) counts[move.color][move.primaryClassification] += 1;
  const largestError = [...moves].sort((a, b) => b.expectedPointsLoss - a.expectedPointsLoss)[0];
  const criticalPlies = [...moves].sort((a, b) => b.criticality - a.criticality).slice(0, 3).map((move) => move.ply);
  const specialPlies = moves.filter((move) => move.primaryClassification === "great" || move.primaryClassification === "brilliant" || move.tags.includes("missed_opportunity")).map((move) => move.ply);
  const classifierMode = options.compatibilityClassifier === false ? "strict" : "compatibility";
  const headline = largestError?.expectedPointsLoss > 0.05
    ? `${largestError.san} on move ${largestError.ply} was the game's largest loss of expected score.`
    : "Both sides kept their largest errors relatively small.";
  return {
    game, moves, positions, whiteAccuracy: gameAccuracy(whiteMoves), blackAccuracy: gameAccuracy(blackMoves),
    summary: { headline, counts, criticalPlies, largestMistakePly: largestError?.ply, specialPlies },
    engineVersion: ENGINE_VERSION, enginePreset: options.preset, analysisModelVersion: ANALYSIS_MODEL_VERSION,
    expectedPointsModelVersion: EXPECTED_POINTS_MODEL_VERSION, classifierVersion: CLASSIFIER_VERSION, classifierMode,
  };
}

export async function analyzeGame(game: ParsedGame, engine: ChessEngine, options: AnalyzeGameOptions): Promise<GameReview> {
  assertAnalysisAllowed(options.safetyState);
  const preset = ENGINE_PRESETS[options.preset];
  await engine.initialize(options.safetyState);
  const fens = [...game.moves.map((move) => move.fenBefore), game.moves.at(-1)!.fenAfter];
  const localCache = new Map<string, EngineAnalysisResult>();
  const positions: PositionReview[] = [];
  const moves: MoveReview[] = [];
  for (let index = 0; index < fens.length; index += 1) {
    if (options.signal?.aborted) throw new DOMException("Analysis was cancelled.", "AbortError");
    const fen = fens[index];
    let result = localCache.get(fen);
    if (!result) {
      result = await engine.analyze({ fen, depth: preset.depth, multiPv: preset.multiPv }, options.signal);
      localCache.set(fen, result);
    }
    positions.push({
      fen, evaluation: { white: lineEvaluationFromWhite(result.lines[0], fen) }, bestMove: result.bestMove, lines: result.lines,
    });
    options.onProgress?.(index + 1, fens.length);
    if (index > 0) {
      moves.push(buildMoveReview(game, positions, moves, index - 1, options));
      options.onPartialReview?.(buildGameReview(game, [...moves], [...positions], options));
    }
  }
  return buildGameReview(game, moves, positions, options);
}
