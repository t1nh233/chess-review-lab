/* Real-artifact smoke test for the packaged Stockfish 18 JS/WASM pair. */
const fs = require("node:fs");
const path = require("node:path");

const enginePath = path.resolve(process.env.STOCKFISH_ENGINE_PATH || "dist/engine/stockfish-18-lite-single.js");
const wasmPath = enginePath.replace(/\.js$/, ".wasm");
if (!fs.existsSync(enginePath) || !fs.existsSync(wasmPath)) throw new Error("Build Stockfish artifacts are missing. Run npm run build first.");

const initEngine = require("stockfish");
const originalLog = console.log;
const listeners = new Set();
console.log = (...args) => {
  const line = args.map(String).join(" ");
  for (const listener of [...listeners]) listener(line);
};

function waitForLine(predicate, command, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      listeners.delete(listener);
      reject(new Error(`Stockfish timed out after command: ${command}`));
    }, timeoutMs);
    const listener = (line) => {
      if (!predicate(line)) return;
      clearTimeout(timer);
      listeners.delete(listener);
      resolve(line);
    };
    listeners.add(listener);
    command();
  });
}

async function analyze(engine, fen, depth = 7) {
  const info = [];
  const collect = (line) => { if (line.startsWith("info ")) info.push(line); };
  listeners.add(collect);
  try {
    const bestLine = await waitForLine((line) => line.startsWith("bestmove "), () => {
      engine.sendCommand(`position fen ${fen}`);
      engine.sendCommand(`go depth ${depth}`);
    });
    const bestMove = bestLine.split(/\s+/)[1];
    const deepest = Math.max(0, ...info.map((line) => Number(/\bdepth (\d+)/.exec(line)?.[1] ?? 0)));
    const pv = [...info].reverse().find((line) => /\bpv\s+\S+/.test(line));
    return { bestMove, deepest, pv, info };
  } finally {
    listeners.delete(collect);
  }
}

(async () => {
  let engine;
  try {
    engine = await initEngine(enginePath);
    await waitForLine((line) => line === "uciok", () => engine.sendCommand("uci"));
    engine.sendCommand("setoption name MultiPV value 3");
    await waitForLine((line) => line === "readyok", () => engine.sendCommand("isready"));

    const start = await analyze(engine, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    if (!start.bestMove || start.bestMove === "(none)" || start.deepest <= 0 || !start.pv) throw new Error("Starting-position smoke result was incomplete.");
    const multiPv = new Set(start.info.map((line) => Number(/\bmultipv (\d+)/.exec(line)?.[1] ?? 0)));
    if (![1, 2, 3].every((index) => multiPv.has(index))) throw new Error("Stockfish did not emit all three requested MultiPV lines.");

    const tactic = await analyze(engine, "4k3/8/8/8/8/8/4q3/4K3 w - - 0 1");
    if (tactic.bestMove !== "e1e2") throw new Error(`Tactical smoke expected e1e2, received ${tactic.bestMove}.`);

    const mate = await analyze(engine, "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2", 8);
    if (mate.bestMove !== "d8h4") throw new Error(`Mate smoke expected d8h4, received ${mate.bestMove}.`);
    if (!mate.info.some((line) => /\bscore mate\s+-?\d+/.test(line))) throw new Error("Mate score was not emitted.");

    originalLog(`Stockfish 18 smoke PASS (${path.basename(enginePath)}): start=${start.bestMove} depth=${start.deepest} multipv=3; tactic=${tactic.bestMove}; mate=${mate.bestMove}`);
  } finally {
    if (engine?.sendCommand) engine.sendCommand("quit");
    console.log = originalLog;
  }
})().catch((error) => {
  console.log = originalLog;
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
