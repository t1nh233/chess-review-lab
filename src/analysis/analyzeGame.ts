import { bookPlyCount } from "../chess/openingBook";
import { Chess } from "chess.js";
import type { ParsedGame } from "../chess/pgn";
import { materialBalance, moverMaterialDelta } from "../chess/material";
import { ANALYSIS_MODEL_VERSION, CLASSIFIER_VERSION, ENGINE_VERSION, EXPECTED_POINTS_MODEL_VERSION } from "../config/versions";
import type { ChessEngine, EngineAnalysisResult, EngineProgress, NormalizedEval } from "../engine/engineTypes";
import type { GameSafetyState } from "../safety/liveGameGuard";
import { assertAnalysisAllowed } from "../safety/liveGameGuard";
import { moveAccuracy, gameAccuracy } from "./accuracy";
import type { GameReview, MoveReview, PositionReview, PrimaryClassification } from "./analysisTypes";
import { detectBrilliantMove } from "./brilliant";
import { calculateCriticality } from "./criticalMoments";
import { lineEvaluationFromWhite, evalToCp } from "./evaluation";
import { explainMove } from "./explanation";
import { moverExpectedPoints, ratingForMover } from "./expectedPoints";
import { detectGreatMove } from "./greatMove";
import { detectMissedOpportunity } from "./missedOpportunity";
import { classifyMove } from "./moveClassifier";
import { PositionAnalysisCache } from "./positionAnalysisCache";
import { shouldRefinePosition, type RefinementDecision } from "./refinementPolicy";
import type { AnalysisPerformanceReport, AnalysisPhase, AnalysisSearchTiming } from "./analysisPerformance";

export const ENGINE_PRESETS = {
  quick: { label: "Fast Review", initialDepth: 12, refinementDepth: 16, depth: 16, expandedMultiPv: 3 },
  balanced: { label: "Compatibility Review", initialDepth: 12, refinementDepth: 18, depth: 20, expandedMultiPv: 3 },
  deep: { label: "Deep Review", initialDepth: 14, refinementDepth: 20, depth: 22, expandedMultiPv: 3 },
} as const;
export type EnginePresetName = keyof typeof ENGINE_PRESETS;

export interface AnalyzeGameOptions {
  safetyState: GameSafetyState; preset: EnginePresetName; signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  onPartialReview?: (review: GameReview) => void;
  onEngineProgress?: (progress: EngineProgress) => void;
  compatibilityClassifier?: boolean;
  positionCache?: PositionAnalysisCache;
  getPriorityPosition?: () => number;
  onPhase?: (phase: AnalysisPhase) => void;
  onPerformanceReport?: (report: AnalysisPerformanceReport) => void;
}

function moverCp(evaluation: NormalizedEval, color: "white" | "black"): number {
  const cp = evalToCp(evaluation);
  return color === "white" ? cp : -cp;
}

function moverMate(evaluation: NormalizedEval, color: "white" | "black"): number | undefined {
  if (evaluation.mate === undefined) return undefined;
  return color === "white" ? evaluation.mate : -evaluation.mate;
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
  const rating = ratingForMover(game, move.color);
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
  if (index === game.moves.length - 1) tags.push("game_ending");
  if (move.ply <= bookPlyCount(game.headers.ECOUrl)) tags.push("book");
  const mateBefore = moverMate(before.evaluation.white, move.color);
  const mateAfter = moverMate(after.evaluation.white, move.color);
  const mateTransition = mateAfter !== undefined && mateAfter < 0 && (mateBefore === undefined || mateBefore >= 0)
    ? "allowed" : mateAfter !== undefined && mateAfter > 0 && (mateBefore === undefined || mateBefore <= 0)
      ? "delivered" : mateBefore !== undefined || mateAfter !== undefined ? "continued" : "none";
  const accuracy = moveAccuracy(epLoss, criticality, {
    forced: legalMoveCount === 1,
    decidedness: Math.abs(epBefore - 0.5) * 2,
    mateLoss: mateTransition === "allowed",
  });
  return {
    ...move, evalBefore: before.evaluation.white, evalAfter: after.evaluation.white,
    expectedPointsBefore: epBefore, expectedPointsAfter: epAfter, expectedPointsLoss: epLoss,
    estimatedAccuracy: accuracy.raw, accuracyWeight: accuracy.weight, primaryClassification: primary, tags,
    bestMove: before.bestMove, principalVariation: before.lines[0]?.moves ?? [], continuationLines: before.lines, criticality,
    analysisDepth: Math.min(before.analysisDepth, after.analysisDepth),
    analysisStatus: before.analysisStatus === "final" && after.analysisStatus === "final" ? "final" : "provisional",
    explanation: explainMove(primary, tags),
    evidence: {
      expectedPointsBefore: epBefore, expectedPointsAfter: epAfter, expectedPointsLoss: epLoss,
      ratingUsed: rating, evalBefore: before.evaluation.white, evalAfter: after.evaluation.white,
      criticality, moveAccuracy: accuracy.raw, gameAccuracyWeight: accuracy.weight,
      mateState: { before: mateBefore, after: mateAfter, transition: mateTransition },
      engineRank, evalLossCp, bestVsSecondGap: uniquenessGap, materialDelta: immediateMaterial,
      reasons: [...brilliant.reasons, ...great.reasons],
    },
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
  const analysisStarted = performance.now();
  await engine.initialize(options.safetyState);
  const fens = [...game.moves.map((move) => move.fenBefore), game.moves.at(-1)!.fenAfter];
  const cache = options.positionCache ?? new PositionAnalysisCache();
  const jobs: AnalysisSearchTiming[] = [];
  const phaseDurationMs: AnalysisPerformanceReport["phaseDurationMs"] = { quick: 0, refinement: 0, multiPvExpansion: 0, lazyContinuation: 0, finalizing: 0 };
  const observations = fens.map(() => ({ bestByDepth: new Map<number, string>(), scoreByDepth: new Map<number, number>(), mateByDepth: new Map<number, string>() }));

  const terminalPosition = (fen: string, status: PositionReview["analysisStatus"]): PositionReview | undefined => {
    const board = new Chess(fen);
    if (!board.isGameOver()) return undefined;
    const evaluation: NormalizedEval = board.isCheckmate() ? { mate: board.turn() === "w" ? -1 : 1 } : { cp: 0 };
    return { fen, evaluation: { white: evaluation }, lines: [], analysisDepth: 0, analysisStatus: status };
  };
  const search = async (fen: string, depth: number, multiPv: number, index: number, phase: AnalysisPhase, queuedAt = performance.now()): Promise<EngineAnalysisResult> => {
    const request = { fen, engineVersion: ENGINE_VERSION, engineMode: options.preset, depth, multiPv };
    const searchStarted = performance.now();
    const cached = cache.get(request);
    if (cached) {
      jobs.push({ phase, positionIndex: index, ply: index, targetDepth: depth, actualDepth: cached.depth, multiPv, queueWaitMs: searchStarted - queuedAt, engineSearchDurationMs: 0, nodes: cached.lines[0]?.nodes, nps: cached.lines[0]?.nps, cache: "hit" });
      return cached;
    }
    let finalProgress: EngineProgress | undefined;
    const result = await engine.analyze({
      fen, depth, multiPv, positionIndex: index,
      onProgress: (progress) => {
        finalProgress = progress;
        if (phase === "quick" && progress.multipv === 1 && progress.currentDepth >= Math.max(6, preset.initialDepth - 4)) {
          if (progress.bestMove) observations[index].bestByDepth.set(progress.currentDepth, progress.bestMove);
          if (progress.scoreCp !== undefined) observations[index].scoreByDepth.set(progress.currentDepth, progress.scoreCp);
          observations[index].mateByDepth.set(progress.currentDepth, progress.mate === undefined ? "cp" : `mate:${Math.sign(progress.mate)}`);
        }
        options.onEngineProgress?.(progress);
      },
    }, options.signal);
    const duration = performance.now() - searchStarted;
    phaseDurationMs[phase] += duration;
    jobs.push({ phase, positionIndex: index, ply: index, targetDepth: depth, actualDepth: result.depth, multiPv, queueWaitMs: searchStarted - queuedAt, engineSearchDurationMs: duration, nodes: finalProgress?.nodes ?? result.lines[0]?.nodes, nps: finalProgress?.nps ?? result.lines[0]?.nps, cache: "miss" });
    cache.set(request, result);
    return result;
  };
  const toPosition = (fen: string, result: EngineAnalysisResult, status: PositionReview["analysisStatus"]): PositionReview => ({
    fen, evaluation: { white: lineEvaluationFromWhite(result.lines[0], fen) }, bestMove: result.bestMove,
    lines: result.lines, analysisDepth: result.depth, analysisStatus: status,
  });

  const positions: PositionReview[] = [];
  let moves: MoveReview[] = [];
  options.onPhase?.("quick");
  const quickQueuedAt = performance.now();
  for (let index = 0; index < fens.length; index += 1) {
    if (options.signal?.aborted) throw new DOMException("Analysis was cancelled.", "AbortError");
    const fen = fens[index];
    const terminal = terminalPosition(fen, "provisional");
    positions.push(terminal ?? toPosition(fen, await search(fen, preset.initialDepth, 1, index, "quick", quickQueuedAt), "provisional"));
    options.onProgress?.(index + 1, fens.length);
    if (index > 0) {
      moves.push(buildMoveReview(game, positions, moves, index - 1, options));
      options.onPartialReview?.(buildGameReview(game, [...moves], [...positions], options));
    }
  }

  moves = [];
  for (let index = 0; index < game.moves.length; index += 1) moves.push(buildMoveReview(game, positions, moves, index, options));
  const decisions = new Map<number, RefinementDecision>();
  const multiPvIndexes = new Set<number>();
  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index];
    const legalMoveCount = new Chess(move.fenBefore).moves().length;
    const beforeObservation = observations[index];
    const afterObservation = observations[index + 1];
    const latestValues = <T,>(values: Map<number, T>, count: number) => [...values.entries()].sort((a, b) => b[0] - a[0]).slice(0, count).map((entry) => entry[1]);
    const observationRange = (values: Map<number, number>) => { const scores = latestValues(values, 3); return scores.length ? Math.max(...scores) - Math.min(...scores) : 0; };
    const changedAtFinalDepths = <T,>(values: Map<number, T>) => new Set(latestValues(values, 2)).size > 1;
    const evaluationRangeCp = Math.max(observationRange(beforeObservation.scoreByDepth), observationRange(afterObservation.scoreByDepth));
    const tactical = /[x+#=]/.test(move.san);
    const materialChange = moverMaterialDelta(move.fenBefore, move.fenAfter, move.color);
    const nearBest = move.uci === positions[index].bestMove || (move.evidence.engineRank !== undefined && (move.evidence.evalLossCp ?? Infinity) <= 45);
    const greatCandidate = legalMoveCount > 1 && nearBest && Math.abs(evalToCp(move.evalBefore)) <= 500
      && (tactical || Math.abs(evalToCp(move.evalBefore) - evalToCp(move.evalAfter)) >= 80);
    const brilliantCandidate = legalMoveCount > 1 && nearBest && materialChange <= -1.5;
    const missCandidate = move.tags.includes("missed_opportunity");
    const onlyMoveCandidate = legalMoveCount === 2 && nearBest && move.criticality >= 0.3;
    const multiPvRequired = greatCandidate || brilliantCandidate || onlyMoveCandidate;
    const decision = shouldRefinePosition({
      expectedPointsLoss: move.expectedPointsLoss,
      criticality: move.criticality,
      bestMoveChanged: changedAtFinalDepths(beforeObservation.bestByDepth) || changedAtFinalDepths(afterObservation.bestByDepth),
      evaluationRangeCp,
      mateStatusChanged: changedAtFinalDepths(beforeObservation.mateByDepth) || changedAtFinalDepths(afterObservation.mateByDepth),
      greatCandidate, brilliantCandidate, missCandidate, onlyMoveCandidate, multiPvRequired,
    });
    decisions.set(index, decision);
    if (multiPvRequired && legalMoveCount > 1) multiPvIndexes.add(index);
  }

  const requestedDepths = new Map<number, number>();
  const requestedAt = new Map<number, number>();
  const requestPosition = (index: number, decision: RefinementDecision) => {
    if (!decision.refine || new Chess(fens[index]).isGameOver()) return;
    const depth = decision.level === "maximum" ? preset.depth : preset.refinementDepth;
    requestedDepths.set(index, Math.max(requestedDepths.get(index) ?? 0, depth));
    if (!requestedAt.has(index)) requestedAt.set(index, performance.now());
  };
  for (const [moveIndex, decision] of decisions) {
    requestPosition(moveIndex, decision);
    requestPosition(moveIndex + 1, decision);
  }
  for (let index = 0; index < positions.length; index += 1) {
    if (!requestedDepths.has(index)) positions[index] = { ...positions[index], analysisStatus: "final" };
  }

  options.onPhase?.("refinement");
  const remaining = new Set(requestedDepths.keys());
  let refined = 0;
  while (remaining.size) {
    const priority = Math.max(0, Math.min(fens.length - 1, options.getPriorityPosition?.() ?? 0));
    const index = [...remaining].sort((a, b) => Math.abs(a - priority) - Math.abs(b - priority) || a - b)[0];
    remaining.delete(index);
    if (options.signal?.aborted) throw new DOMException("Analysis was cancelled.", "AbortError");
    const fen = fens[index];
    const terminal = terminalPosition(fen, "final");
    const targetDepth = requestedDepths.get(index) ?? preset.refinementDepth;
    positions[index] = terminal ?? toPosition(fen, await search(fen, targetDepth, 1, index, "refinement", requestedAt.get(index)), "final");
    refined += 1; options.onProgress?.(refined, requestedDepths.size);
    const refinedMoves: MoveReview[] = [];
    for (let moveIndex = 0; moveIndex < game.moves.length; moveIndex += 1) refinedMoves.push(buildMoveReview(game, positions, refinedMoves, moveIndex, options));
    options.onPartialReview?.(buildGameReview(game, refinedMoves, [...positions], options));
  }

  moves = [];
  for (let index = 0; index < game.moves.length; index += 1) moves.push(buildMoveReview(game, positions, moves, index, options));

  const expansionIndexes = [...multiPvIndexes];
  const expansionQueuedAt = performance.now();
  options.onPhase?.("multiPvExpansion");
  let expanded = 0;
  for (const index of expansionIndexes) {
    if (options.signal?.aborted) throw new DOMException("Analysis was cancelled.", "AbortError");
    if (new Chess(fens[index]).moves().length <= 1) continue;
    const result = await search(fens[index], requestedDepths.get(index) ?? preset.depth, preset.expandedMultiPv, index, "multiPvExpansion", expansionQueuedAt);
    positions[index] = toPosition(fens[index], result, "final");
    expanded += 1; options.onProgress?.(expanded, expansionIndexes.length);
  }
  const finalizingStarted = performance.now();
  options.onPhase?.("finalizing");
  moves = [];
  for (let index = 0; index < game.moves.length; index += 1) moves.push(buildMoveReview(game, positions, moves, index, options));
  const review = buildGameReview(game, moves, positions, options);
  phaseDurationMs.finalizing += performance.now() - finalizingStarted;
  const completedAt = performance.now();
  options.onPerformanceReport?.({
    totalDurationMs: completedAt - analysisStarted,
    popupSummaryDurationMs: completedAt - analysisStarted,
    optionalDeepAnalysisMs: 0,
    baseOnlyPositionCount: positions.filter((position) => position.analysisDepth <= preset.initialDepth && position.analysisDepth > 0).length,
    refinedToDepth18Count: jobs.filter((job) => job.phase === "refinement" && job.targetDepth === 18).length,
    refinedToDepth20Count: jobs.filter((job) => job.phase === "refinement" && job.targetDepth === 20).length,
    multiPv3JobCount: jobs.filter((job) => job.multiPv === 3).length,
    jobs,
    phaseDurationMs,
  });
  return review;
}
