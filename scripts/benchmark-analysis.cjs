const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { Chess } = require("chess.js");
const initEngine = require("stockfish");

const fixturePath = path.resolve(process.env.BENCHMARK_PGN || "tests/fixtures/clean-game.pgn");
const enginePath = path.resolve(process.env.STOCKFISH_ENGINE_PATH || "node_modules/stockfish/bin/stockfish-18-single.js");
const configuredDepth = Number(process.env.BENCHMARK_DEPTH || 12);
const strategy = process.env.BENCHMARK_STRATEGY || "selective";
const pgn = fs.readFileSync(fixturePath, "utf8");
const game = new Chess();
game.loadPgn(pgn, { strict: false });
const replay = new Chess(game.getHeaders().SetUp === "1" && game.getHeaders().FEN ? game.getHeaders().FEN : undefined);
const fens = [replay.fen()];
const history = game.history({ verbose: true });
for (const move of history) {
  replay.move({ from: move.from, to: move.to, promotion: move.promotion });
  fens.push(replay.fen());
}

const originalLog = console.log;
const listeners = new Set();
console.log = (...args) => {
  const line = args.map(String).join(" ");
  for (const listener of [...listeners]) listener(line);
};

function waitFor(predicate, command, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const listener = (line) => {
      if (!predicate(line)) return;
      clearTimeout(timer);
      listeners.delete(listener);
      resolve(line);
    };
    const timer = setTimeout(() => {
      listeners.delete(listener);
      reject(new Error(`Timeout while benchmarking ${command.name || "Stockfish command"}.`));
    }, timeoutMs);
    listeners.add(listener);
    command();
  });
}

async function search(engine, fen, depth, multiPv) {
  const info = [];
  const collect = (line) => { if (line.startsWith("info ")) info.push(line); };
  listeners.add(collect);
  const started = performance.now();
  try {
    const best = await waitFor((line) => line.startsWith("bestmove "), () => {
      engine.sendCommand(`setoption name MultiPV value ${multiPv}`);
      engine.sendCommand(`position fen ${fen}`);
      engine.sendCommand(`go depth ${depth}`);
    });
    const finalDepth = Math.max(0, ...info.map((line) => Number(/\bdepth (\d+)/.exec(line)?.[1] || 0)));
    const totalNodes = Math.max(0, ...info.map((line) => Number(/\bnodes (\d+)/.exec(line)?.[1] || 0)));
    const finalNps = Number([...info].reverse().find((line) => /\bnps \d+/.test(line))?.match(/\bnps (\d+)/)?.[1] || 0);
    const pv1 = [...info].reverse().find((line) => /\bmultipv 1\b/.test(line) && /\bscore (?:cp|mate) -?\d+/.test(line));
    const scoreMatch = pv1?.match(/\bscore (cp|mate) (-?\d+)/);
    const meaningful = info.filter((line) => /\bmultipv 1\b/.test(line));
    const byDepth = new Map(); for (const line of meaningful) byDepth.set(Number(/\bdepth (\d+)/.exec(line)?.[1] || 0), line);
    const finalUpdates = [...byDepth.entries()].sort((a, b) => b[0] - a[0]);
    const scoreHistory = finalUpdates.slice(0, 3).map(([, line]) => Number(/\bscore cp (-?\d+)/.exec(line)?.[1])).filter(Number.isFinite);
    const bestMoves = new Set(finalUpdates.slice(0, 2).map(([, line]) => /\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line)?.[1]).filter(Boolean));
    const mateStates = new Set(finalUpdates.slice(0, 2).map(([, line]) => /\bscore mate (-?\d+)/.test(line) ? `mate:${Math.sign(Number(/\bscore mate (-?\d+)/.exec(line)?.[1]))}` : "cp"));
    return { durationMs: performance.now() - started, finalDepth, totalNodes, finalNps, bestMove: best.split(/\s+/)[1], scoreCp: scoreMatch?.[1] === "cp" ? Number(scoreMatch[2]) : undefined, mate: scoreMatch?.[1] === "mate" ? Number(scoreMatch[2]) : undefined, evaluationRangeCp: scoreHistory.length ? Math.max(...scoreHistory) - Math.min(...scoreHistory) : 0, bestMoveChanged: bestMoves.size > 1, mateStatusChanged: mateStates.size > 1 };
  } finally {
    listeners.delete(collect);
  }
}

const refinementConfig = JSON.parse(fs.readFileSync(path.resolve("src/analysis/refinementConfig.json"), "utf8"));
const classificationBoundaries = [0.02, 0.05, 0.10, 0.20];
const headers = game.getHeaders();
const ratingFor = (color) => Number(color === "white" ? headers.WhiteElo : headers.BlackElo) || 1500;
const whiteCp = (result, fen) => {
  const raw = result.mate !== undefined ? Math.sign(result.mate) * (100000 - Math.min(Math.abs(result.mate), 100) * 100) : result.scoreCp || 0;
  return fen.split(" ")[1] === "b" ? -raw : raw;
};
const moverEp = (cp, color, rating) => {
  const scale = Math.max(180, 260 + Math.max(-700, Math.min(1000, rating - 1500)) * 0.035);
  const white = 1 / (1 + Math.exp(-cp / scale));
  return color === "white" ? white : 1 - white;
};
const material = (fen, color) => {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }; const board = new Chess(fen).board();
  const balance = board.flat().reduce((sum, piece) => sum + (piece ? values[piece.type] * (piece.color === "w" ? 1 : -1) : 0), 0);
  return balance * (color === "white" ? 1 : -1);
};

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function runQueue(engine, cache, warm) {
  const started = performance.now();
  const searches = [];
  const requests = new Map();
  let cacheHits = 0;
  let cacheMisses = 0;
  let multiPv1SearchCount = 0;
  let multiPv2SearchCount = 0;
  let multiPv3SearchCount = 0;
  const primaryPositions = fens.map((fen, positionIndex) => ({ fen, positionIndex })).filter(({ fen }) => !new Chess(fen).isGameOver());
  const phaseMetrics = new Map();
  const jobs = [];
  const selectionReasons = {};
  const baseResults = new Map();
  const refinedResults = new Map();
  const execute = async (request) => {
    const { fen, positionIndex, phase, depth, multiPv } = request;
    const queueWaitMs = Math.max(0, performance.now() - (request.queuedAt ?? performance.now()));
    const phaseMetric = phaseMetrics.get(phase) ?? { durationMs: 0, engineSearchCount: 0, cacheHits: 0, cacheMisses: 0, nodes: 0 };
    phaseMetrics.set(phase, phaseMetric);
    const key = `${fen}|${depth}|${multiPv}`;
    requests.set(key, (requests.get(key) || 0) + 1);
    if (cache.has(key)) { const cached = cache.get(key); cacheHits += 1; phaseMetric.cacheHits += 1; jobs.push({ phase, positionIndex, ply: positionIndex, targetDepth: depth, actualDepth: cached.finalDepth, multiPv, queueWaitMs: Number(queueWaitMs.toFixed(1)), engineSearchDurationMs: 0, nodes: cached.totalNodes, nps: cached.finalNps, cache: "hit" }); if (phase === "fastPass") baseResults.set(positionIndex, cached); if (phase === "refinement") refinedResults.set(positionIndex, cached); return cached; }
    cacheMisses += 1;
    phaseMetric.cacheMisses += 1;
    if (multiPv === 1) multiPv1SearchCount += 1;
    if (multiPv === 2) multiPv2SearchCount += 1;
    if (multiPv === 3) multiPv3SearchCount += 1;
    const result = await search(engine, fen, depth, multiPv);
    searches.push(result);
    cache.set(key, result);
    if (phase === "fastPass") baseResults.set(positionIndex, result);
    if (phase === "refinement") refinedResults.set(positionIndex, result);
    phaseMetric.durationMs += result.durationMs;
    phaseMetric.engineSearchCount += 1;
    phaseMetric.nodes += result.totalNodes;
    jobs.push({ phase, positionIndex, ply: positionIndex, targetDepth: depth, actualDepth: result.finalDepth, multiPv, queueWaitMs: Number(queueWaitMs.toFixed(1)), engineSearchDurationMs: Number(result.durationMs.toFixed(1)), nodes: result.totalNodes, nps: result.finalNps, cache: "miss" });
    return result;
  };
  const initialDepth = Math.min(12, configuredDepth);
  if (strategy === "legacy") {
    const queuedAt = performance.now(); for (const position of primaryPositions) await execute({ ...position, phase: "refinement", depth: configuredDepth, multiPv: 3, queuedAt });
  } else {
    const fastQueuedAt = performance.now(); for (const position of primaryPositions) await execute({ ...position, phase: "fastPass", depth: initialDepth, multiPv: 1, queuedAt: fastQueuedAt });
    if (strategy === "optimized") {
      const refinementQueuedAt = performance.now(); for (const position of primaryPositions) await execute({ ...position, phase: "refinement", depth: configuredDepth, multiPv: 1, queuedAt: refinementQueuedAt });
      const expansionQueuedAt = performance.now();
      for (const [index, move] of history.entries()) {
        const before = refinedResults.get(index); const after = refinedResults.get(index + 1);
        if (!before) continue;
        const beforeCp = Math.abs(whiteCp(before, fens[index]));
        const terminalAfterCp = new Chess(fens[index + 1]).isCheckmate() ? (new Chess(fens[index + 1]).turn() === "w" ? -99900 : 99900) : 0;
        const afterCp = after ? whiteCp(after, fens[index + 1]) : terminalAfterCp;
        const swing = Math.abs(whiteCp(before, fens[index]) - afterCp);
        const color = move.color === "w" ? "white" : "black"; const played = `${move.from}${move.to}${move.promotion || ""}`;
        const tactical = /[x+#=]/.test(move.san) || Math.abs(material(fens[index + 1], color) - material(fens[index], color)) >= 1.5;
        if (played === before.bestMove && beforeCp <= 500 && (tactical || swing >= 80)) await execute({ fen: fens[index], positionIndex: index, phase: "multiPvExpansion", depth: configuredDepth, multiPv: 3, queuedAt: expansionQueuedAt });
      }
    } else {
      const moveEvidence = history.map((move, index) => {
        const before = baseResults.get(index); const after = baseResults.get(index + 1);
        const color = move.color === "w" ? "white" : "black";
        const beforeCp = whiteCp(before, fens[index]); const afterCp = after ? whiteCp(after, fens[index + 1]) : beforeCp;
        const epBefore = moverEp(beforeCp, color, ratingFor(color)); const epAfter = moverEp(afterCp, color, ratingFor(color));
        const loss = Math.max(0, epBefore - epAfter < 0.002 ? 0 : epBefore - epAfter);
        const criticality = Math.max(0, Math.min(1, 0.35 * (1 - Math.min(1, Math.abs(epBefore - 0.5) * 2)) + 0.25 * Math.min(1, loss / 0.25)));
        const legal = new Chess(fens[index]).moves().length; const played = `${move.from}${move.to}${move.promotion || ""}`; const nearBest = played === before.bestMove;
        const tactical = /[x+#=]/.test(move.san); const swing = Math.abs(beforeCp - afterCp); const sacrifice = material(fens[index], color) - material(fens[index + 1], color);
        const great = legal > 1 && nearBest && Math.abs(beforeCp) <= 500 && (tactical || swing >= 80); const brilliant = legal > 1 && nearBest && sacrifice >= 1.5; const onlyMove = legal === 2 && nearBest && criticality >= 0.3;
        return { loss, criticality, legal, great, brilliant, onlyMove, instability: Math.max(before.evaluationRangeCp, after?.evaluationRangeCp || 0), bestMoveChanged: before.bestMoveChanged || Boolean(after?.bestMoveChanged), mateStatusChanged: before.mateStatusChanged || Boolean(after?.mateStatusChanged) };
      });
      const requested = new Map(); const expansions = new Set();
      moveEvidence.forEach((evidence, index) => {
        const miss = index > 0 && moveEvidence[index - 1].loss >= 0.18 && evidence.loss >= 0.14;
        const reasonFlags = { classificationBoundary: classificationBoundaries.some((boundary) => Math.abs(evidence.loss - boundary) <= refinementConfig.classificationBoundaryMargin), bestMoveChanged: evidence.bestMoveChanged, mateStatusChanged: evidence.mateStatusChanged, greatCandidate: evidence.great, brilliantCandidate: evidence.brilliant, onlyMoveCandidate: evidence.onlyMove, missCandidate: miss, highCriticality: evidence.criticality >= refinementConfig.highCriticalityThreshold, highInstability: evidence.instability >= refinementConfig.highEvaluationRangeCp, criticality: evidence.criticality >= refinementConfig.criticalityThreshold, instability: evidence.instability >= refinementConfig.evaluationRangeCp };
        for (const [reason, matched] of Object.entries(reasonFlags)) if (matched) selectionReasons[reason] = (selectionReasons[reason] || 0) + 1;
        const maximum = reasonFlags.classificationBoundary || reasonFlags.bestMoveChanged || reasonFlags.mateStatusChanged || reasonFlags.brilliantCandidate || reasonFlags.onlyMoveCandidate || reasonFlags.missCandidate || reasonFlags.highCriticality || reasonFlags.highInstability;
        const intermediate = reasonFlags.greatCandidate || reasonFlags.criticality || reasonFlags.instability;
        const targetDepth = maximum ? configuredDepth : Math.min(18, configuredDepth);
        if ((maximum || intermediate) && targetDepth > initialDepth) for (const positionIndex of [index, index + 1]) if (baseResults.has(positionIndex)) requested.set(positionIndex, Math.max(requested.get(positionIndex) || 0, targetDepth));
        if ((evidence.great || evidence.brilliant || evidence.onlyMove) && evidence.legal > 1) expansions.add(index);
      });
      const refinementQueuedAt = performance.now(); for (const [positionIndex, depth] of requested) await execute({ fen: fens[positionIndex], positionIndex, phase: "refinement", depth, multiPv: 1, queuedAt: refinementQueuedAt });
      const expansionQueuedAt = performance.now(); for (const positionIndex of expansions) await execute({ fen: fens[positionIndex], positionIndex, phase: "multiPvExpansion", depth: requested.get(positionIndex) || configuredDepth, multiPv: 3, queuedAt: expansionQueuedAt });
    }
  }
  const durations = searches.map((item) => item.durationMs);
  return {
    cacheState: warm ? "warm" : "cold",
    totalAnalysisDurationMs: Number((performance.now() - started).toFixed(1)),
    numberOfPlies: fens.length - 1,
    uniquePositionCount: new Set(fens).size,
    engineSearchCount: searches.length,
    multiPv1SearchCount,
    multiPv2SearchCount,
    multiPv3SearchCount,
    averageSearchMs: Number((durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length)).toFixed(1)),
    medianSearchMs: Number(percentile(durations, 0.5).toFixed(1)),
    p95SearchMs: Number(percentile(durations, 0.95).toFixed(1)),
    cacheHits,
    cacheMisses,
    workerCount: 1,
    configuredDepth,
    averageFinalDepth: Number((searches.reduce((sum, item) => sum + item.finalDepth, 0) / Math.max(1, searches.length)).toFixed(1)),
    totalNodes: searches.reduce((sum, item) => sum + item.totalNodes, 0),
    averageNps: Math.round(searches.reduce((sum, item) => sum + item.finalNps, 0) / Math.max(1, searches.length)),
    duplicateFenSearches: [...requests.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0),
    phases: Object.fromEntries([...phaseMetrics].map(([phase, value]) => [phase, { ...value, durationMs: Number(value.durationMs.toFixed(1)) }])),
    timeToCompletedPopupSummaryMs: Number((performance.now() - started).toFixed(1)),
    optionalDeepAnalysisMs: 0,
    baseOnlyPositionCount: primaryPositions.length - new Set(jobs.filter((job) => job.phase === "refinement").map((job) => job.positionIndex)).size,
    refinedToDepth18Count: jobs.filter((job) => job.phase === "refinement" && job.targetDepth === 18).length,
    refinedToDepth20Count: jobs.filter((job) => job.phase === "refinement" && job.targetDepth === 20).length,
    selectionReasons,
    ...(process.env.BENCHMARK_VERBOSE === "1" ? { jobs } : {}),
  };
}

(async () => {
  let engine;
  try {
    const totalStarted = performance.now();
    const initStarted = performance.now();
    engine = await initEngine(enginePath);
    const engineInitializationMs = Number((performance.now() - initStarted).toFixed(1));
    await waitFor((line) => line === "uciok", () => engine.sendCommand("uci"));
    engine.sendCommand("setoption name Hash value 64");
    engine.sendCommand("ucinewgame");
    await waitFor((line) => line === "readyok", () => engine.sendCommand("isready"));
    const cache = new Map();
    const cold = await runQueue(engine, cache, false);
    const warm = await runQueue(engine, cache, true);
    originalLog(JSON.stringify({
      game: path.basename(fixturePath, path.extname(fixturePath)),
      strategy,
      engine: path.basename(enginePath),
      engineInitializationMs,
      totalBenchmarkDurationMs: Number((performance.now() - totalStarted).toFixed(1)),
      cold,
      warm,
    }, null, 2));
  } finally {
    if (engine?.sendCommand) engine.sendCommand("quit");
    console.log = originalLog;
  }
})().catch((error) => {
  console.log = originalLog;
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
