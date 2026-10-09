import type { GameSafetyState } from "../safety/liveGameGuard";
import { assertAnalysisAllowed } from "../safety/liveGameGuard";
import type { ChessEngine, EngineAnalysisRequest, EngineAnalysisResult, EngineLine, EngineWorkerInput, EngineWorkerOutput } from "./engineTypes";
import { parseBestMove, parseInfoLine } from "./uciParser";

type Waiter = { predicate: (line: string) => boolean; resolve: (line: string) => void; reject: (error: Error) => void; onLine?: (line: string) => void };
export interface StockfishClientOptions {
  workerFactory?: (url: string, options: WorkerOptions) => Worker;
  startupTimeoutMs?: number;
  analysisTimeoutMs?: number;
  analysisHardTimeoutMs?: number;
}

export class StockfishClient implements ChessEngine {
  private worker: Worker | null = null;
  private waiters: Waiter[] = [];
  private analyzing = false;
  private searchQueue: Promise<void> = Promise.resolve();
  private queuedSearches = 0;
  private safetyState: GameSafetyState = "UNKNOWN";
  private readonly workerFactory: (url: string, options: WorkerOptions) => Worker;
  private readonly startupTimeoutMs: number;
  private readonly analysisTimeoutMs: number;
  private readonly analysisHardTimeoutMs: number;

  constructor(options: StockfishClientOptions = {}) {
    this.workerFactory = options.workerFactory ?? ((url, workerOptions) => new Worker(url, workerOptions));
    this.startupTimeoutMs = options.startupTimeoutMs ?? 15_000;
    this.analysisTimeoutMs = options.analysisTimeoutMs ?? 30_000;
    this.analysisHardTimeoutMs = options.analysisHardTimeoutMs ?? 300_000;
  }

  async initialize(safetyState: GameSafetyState): Promise<void> {
    assertAnalysisAllowed(safetyState);
    this.dispose();
    this.safetyState = safetyState;
    const workerUrl = chrome.runtime.getURL("engine/stockfishWorker.js");
    const engineUrl = chrome.runtime.getURL("engine/stockfish-18-single.js");
    this.worker = this.workerFactory(workerUrl, { type: "module" });
    this.worker.onmessage = (event: MessageEvent<EngineWorkerOutput>) => this.handleMessage(event.data);
    this.worker.onerror = () => this.failWorker(new Error("Stockfish worker failed."));
    try {
      const ready = this.waitForWorkerReady();
      this.post({ type: "INITIALIZE", safetyState, engineUrl });
      await ready;
      const uciReady = this.waitFor((line) => line === "uciok", this.startupTimeoutMs, "Stockfish UCI handshake timed out.");
      this.command("uci");
      await uciReady;
      this.command("setoption name Hash value 128");
      this.command("ucinewgame");
      const engineReady = this.waitFor((line) => line === "readyok", this.startupTimeoutMs, "Stockfish readiness check timed out.");
      this.command("isready");
      await engineReady;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /**
   * Searches run one at a time. A request that arrives while another search is still running (for example one that
   * was just aborted and is waiting for Stockfish's final `bestmove`) queues behind it instead of failing.
   */
  async analyze(request: EngineAnalysisRequest, signal?: AbortSignal): Promise<EngineAnalysisResult> {
    assertAnalysisAllowed(this.safetyState);
    const previous = this.searchQueue;
    const mustWait = this.queuedSearches > 0;
    this.queuedSearches += 1;
    let release!: () => void;
    this.searchQueue = new Promise<void>((resolve) => { release = resolve; });
    try {
      if (mustWait) await previous;
      if (signal?.aborted) throw new DOMException("Analysis was cancelled.", "AbortError");
      return await this.runAnalysis(request, signal);
    } finally { this.queuedSearches -= 1; release(); }
  }

  private async runAnalysis(request: EngineAnalysisRequest, signal?: AbortSignal): Promise<EngineAnalysisResult> {
    assertAnalysisAllowed(this.safetyState);
    if (!this.worker) throw new Error("Stockfish failed to initialize.");
    if (this.analyzing) throw new Error("Stockfish is already analyzing a position.");
    if (signal?.aborted) throw new DOMException("Analysis was cancelled.", "AbortError");
    this.analyzing = true;
    const lines = new Map<number, EngineLine>();
    const onAbort = () => this.command("stop");
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      this.command(`setoption name MultiPV value ${request.multiPv ?? 1}`);
      this.command(`position fen ${request.fen}`);
      const go = request.movetimeMs ? `go movetime ${request.movetimeMs}` : `go depth ${request.depth ?? 18}`;
      const bestLinePromise = this.waitForAnalysis((line) => {
        const info = parseInfoLine(line);
        if (info) {
          const prior = lines.get(info.multipv);
          if (!prior || info.depth >= prior.depth) lines.set(info.multipv, info);
          request.onProgress?.({
            positionIndex: request.positionIndex ?? 0,
            currentDepth: info.depth,
            targetDepth: request.depth ?? info.depth,
            nodes: info.nodes,
            nps: info.nps,
            multipv: info.multipv,
            bestMove: info.moves[0],
            scoreCp: info.scoreCp,
            mate: info.mate,
          });
        }
        return line.startsWith("bestmove ");
      }, this.analysisTimeoutMs, this.analysisHardTimeoutMs, "Stockfish analysis timed out.");
      this.command(go);
      let bestLine: string;
      try { bestLine = await bestLinePromise; }
      catch (error) { this.dispose(); throw error; }
      if (signal?.aborted) throw new DOMException("Analysis was cancelled.", "AbortError");
      const bestMove = parseBestMove(bestLine);
      if (!bestMove) throw new Error("Stockfish returned no legal move.");
      const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
      if (!sorted.length) throw new Error("Stockfish returned no evaluation data.");
      return { bestMove, depth: Math.max(0, ...sorted.map((line) => line.depth)), lines: sorted };
    } finally {
      signal?.removeEventListener("abort", onAbort);
      this.analyzing = false;
    }
  }

  async stop(): Promise<void> { if (this.worker) this.command("stop"); }
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiters.splice(0).forEach((w) => w.reject(new Error("Engine disposed.")));
  }
  private post(message: EngineWorkerInput): void { this.worker?.postMessage(message); }
  private command(command: string): void { this.post({ type: "COMMAND", command }); }
  private waitFor(predicate: (line: string) => boolean, timeoutMs: number, timeoutMessage: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout: { timer?: ReturnType<typeof setTimeout> } = {};
      const waiter: Waiter = {
        predicate,
        resolve: (line) => { clearTimeout(timeout.timer); resolve(line); },
        reject: (error) => { clearTimeout(timeout.timer); reject(error); },
      };
      timeout.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error(timeoutMessage));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }
  private waitForAnalysis(predicate: (line: string) => boolean, inactivityMs: number, hardTimeoutMs: number, timeoutMessage: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let inactivityTimer: ReturnType<typeof setTimeout>;
      const remove = (waiter: Waiter) => { const index = this.waiters.indexOf(waiter); if (index >= 0) this.waiters.splice(index, 1); };
      const cleanup = () => { clearTimeout(inactivityTimer); clearTimeout(hardTimer); };
      const fail = (waiter: Waiter, message: string) => { cleanup(); remove(waiter); reject(new Error(message)); };
      const waiter: Waiter = {
        predicate,
        resolve: (line) => { cleanup(); resolve(line); },
        reject: (error) => { cleanup(); reject(error); },
        onLine: (line) => {
          if (!line.startsWith("info ")) return;
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => fail(waiter, `${timeoutMessage} No UCI progress was received.`), inactivityMs);
        },
      };
      inactivityTimer = setTimeout(() => fail(waiter, `${timeoutMessage} No UCI progress was received.`), inactivityMs);
      const hardTimer = setTimeout(() => fail(waiter, `${timeoutMessage} Hard search limit reached.`), hardTimeoutMs);
      this.waiters.push(waiter);
    });
  }
  private waitForWorkerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = this.worker;
      if (!worker) { reject(new Error("Stockfish failed to initialize.")); return; }
      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener("message", listener);
        worker.removeEventListener("error", onError);
      };
      const listener = (event: MessageEvent<EngineWorkerOutput>) => {
        if (event.data.type === "READY") { cleanup(); resolve(); }
        if (event.data.type === "ERROR") { cleanup(); reject(new Error(event.data.message)); }
      };
      const onError = () => { cleanup(); reject(new Error("Stockfish worker failed to load.")); };
      const timer = setTimeout(() => { cleanup(); reject(new Error("Stockfish worker startup timed out.")); }, this.startupTimeoutMs);
      worker.addEventListener("message", listener as EventListener);
      worker.addEventListener("error", onError);
    });
  }
  private failWaiters(error: Error): void { this.waiters.splice(0).forEach((waiter) => waiter.reject(error)); }
  private failWorker(error: Error): void {
    this.worker?.terminate();
    this.worker = null;
    this.analyzing = false;
    this.safetyState = "UNKNOWN";
    this.failWaiters(error);
  }
  private handleMessage(message: EngineWorkerOutput): void {
    if (message.type === "ERROR") {
      this.failWorker(new Error(message.message));
      return;
    }
    if (message.type !== "LINE") return;
    for (const waiter of [...this.waiters]) waiter.onLine?.(message.line);
    const index = this.waiters.findIndex((waiter) => waiter.predicate(message.line));
    if (index >= 0) this.waiters.splice(index, 1)[0].resolve(message.line);
  }
}
