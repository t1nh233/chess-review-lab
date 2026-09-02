const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { Chess } = require("chess.js");
const initEngine = require("stockfish");

const fixturePath = path.resolve(process.env.BENCHMARK_PGN || "tests/fixtures/clean-game.pgn");
const enginePath = path.resolve(process.env.STOCKFISH_ENGINE_PATH || "node_modules/stockfish/bin/stockfish-18-lite-single.js");
const configuredDepth = Number(process.env.BENCHMARK_DEPTH || 12);
const strategy = process.env.BENCHMARK_STRATEGY || "optimized";
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
    return { durationMs: performance.now() - started, finalDepth, totalNodes, finalNps, bestMove: best.split(/\s+/)[1] };
  } finally {
    listeners.delete(collect);
  }
}

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
  const primaryFens = fens.filter((fen) => !new Chess(fen).isGameOver());
  const requestsToRun = strategy === "legacy"
    ? primaryFens.map((fen) => ({ fen, depth: configuredDepth, multiPv: 3 }))
    : [
        ...primaryFens.map((fen) => ({ fen, depth: Math.min(10, configuredDepth), multiPv: 1 })),
        ...primaryFens.map((fen) => ({ fen, depth: configuredDepth, multiPv: 1 })),
        ...history.flatMap((move, index) => /[x+#=]/.test(move.san) ? [{ fen: fens[index], depth: configuredDepth, multiPv: 3 }] : []),
      ];
  for (const request of requestsToRun) {
    const { fen, depth, multiPv } = request;
    const key = `${fen}|${depth}|${multiPv}`;
    requests.set(key, (requests.get(key) || 0) + 1);
    if (cache.has(key)) { cacheHits += 1; continue; }
    cacheMisses += 1;
    if (multiPv === 1) multiPv1SearchCount += 1;
    if (multiPv === 2) multiPv2SearchCount += 1;
    if (multiPv === 3) multiPv3SearchCount += 1;
    const result = await search(engine, fen, depth, multiPv);
    searches.push(result);
    cache.set(key, result);
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
