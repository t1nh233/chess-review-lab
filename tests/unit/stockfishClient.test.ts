import { afterEach, describe, expect, it, vi } from "vitest";
import type { EngineWorkerInput, EngineWorkerOutput } from "../../src/engine/engineTypes";
import { StockfishClient } from "../../src/engine/stockfishClient";

class FakeWorker extends EventTarget {
  onmessage: ((event: MessageEvent<EngineWorkerOutput>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: EngineWorkerInput[] = [];
  terminated = false;
  onPost?: (message: EngineWorkerInput) => void;

  postMessage(message: EngineWorkerInput) {
    this.posted.push(message);
    this.onPost?.(message);
  }

  terminate() { this.terminated = true; }

  emit(data: EngineWorkerOutput) {
    const event = new MessageEvent<EngineWorkerOutput>("message", { data });
    this.onmessage?.(event);
    this.dispatchEvent(event);
  }

  fail() {
    const event = new Event("error");
    this.onerror?.(event);
    this.dispatchEvent(event);
  }
}

function clientFor(worker: FakeWorker, timeoutMs = 100, hardTimeoutMs = 300): StockfishClient {
  return new StockfishClient({ workerFactory: () => worker as unknown as Worker, startupTimeoutMs: timeoutMs, analysisTimeoutMs: timeoutMs, analysisHardTimeoutMs: hardTimeoutMs });
}

function handshake(worker: FakeWorker) {
  worker.onPost = (message) => {
    if (message.type === "INITIALIZE") queueMicrotask(() => worker.emit({ type: "READY" }));
    if (message.type === "COMMAND" && message.command === "uci") queueMicrotask(() => worker.emit({ type: "LINE", line: "uciok" }));
    if (message.type === "COMMAND" && message.command === "isready") queueMicrotask(() => worker.emit({ type: "LINE", line: "readyok" }));
  };
}

afterEach(() => vi.useRealTimers());

describe("StockfishClient lifecycle", () => {
  it.each(["LIVE_GAME", "UNKNOWN"] as const)("does not create a worker for unsafe state %s", async (safetyState) => {
    const factory = vi.fn(() => new FakeWorker() as unknown as Worker);
    const client = new StockfishClient({ workerFactory: factory });
    await expect(client.initialize(safetyState)).rejects.toThrow(/progress|verify/);
    expect(factory).not.toHaveBeenCalled();
  });
  it("completes the worker and UCI handshake", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker);
    await client.initialize("SAFE_IMPORTED_PGN");
    expect(worker.posted).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "INITIALIZE" }),
      { type: "COMMAND", command: "uci" },
      { type: "COMMAND", command: "setoption name Hash value 128" },
      { type: "COMMAND", command: "ucinewgame" },
      { type: "COMMAND", command: "isready" },
    ]));
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it("streams actual UCI depths and does not clear hash for each position", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker);
    await client.initialize("SAFE_IMPORTED_PGN");
    const progress = vi.fn();
    worker.onPost = (message) => {
      if (message.type === "COMMAND" && message.command.startsWith("go ")) queueMicrotask(() => {
        worker.emit({ type: "LINE", line: "info depth 9 multipv 1 score cp 10 nodes 20 nps 2000 pv e2e4" });
        worker.emit({ type: "LINE", line: "info depth 10 multipv 1 score cp 12 nodes 40 nps 4000 pv e2e4" });
        worker.emit({ type: "LINE", line: "bestmove e2e4" });
      });
    };
    await client.analyze({ fen: "startpos", depth: 10, positionIndex: 7, onProgress: progress });
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ positionIndex: 7, currentDepth: 10, targetDepth: 10, nodes: 40, nps: 4000 }));
    expect(worker.posted.filter((message) => message.type === "COMMAND" && message.command === "ucinewgame")).toHaveLength(1);
    client.dispose();
  });

  it("does not arm search timeouts before a queued job actually starts", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker, 25, 100);
    await client.initialize("SAFE_IMPORTED_PGN");
    vi.useFakeTimers();
    expect(vi.getTimerCount()).toBe(0);
    const pending = client.analyze({ fen: "startpos", depth: 10 });
    expect(vi.getTimerCount()).toBe(2);
    client.dispose();
    await expect(pending).rejects.toThrow(/disposed/i);
  });

  it("refreshes the inactivity watchdog when real UCI progress arrives", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker, 25, 150);
    await client.initialize("SAFE_IMPORTED_PGN");
    vi.useFakeTimers();
    worker.onPost = (message) => {
      if (message.type !== "COMMAND" || !message.command.startsWith("go ")) return;
      setTimeout(() => worker.emit({ type: "LINE", line: "info depth 8 multipv 1 score cp 8 nodes 20 nps 1000 pv e2e4" }), 20);
      setTimeout(() => worker.emit({ type: "LINE", line: "info depth 9 multipv 1 score cp 9 nodes 40 nps 1000 pv e2e4" }), 40);
      setTimeout(() => worker.emit({ type: "LINE", line: "info depth 10 multipv 1 score cp 10 nodes 80 nps 1000 pv e2e4" }), 60);
      setTimeout(() => worker.emit({ type: "LINE", line: "bestmove e2e4" }), 70);
    };
    const pending = client.analyze({ fen: "startpos", depth: 10 });
    await vi.advanceTimersByTimeAsync(75);
    await expect(pending).resolves.toMatchObject({ bestMove: "e2e4", depth: 10 });
    client.dispose();
  });

  it("disposes a search worker after inactivity timeout so stale output cannot leak", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker, 25, 150);
    await client.initialize("SAFE_IMPORTED_PGN");
    vi.useFakeTimers();
    const pending = client.analyze({ fen: "startpos", depth: 20 });
    const rejection = expect(pending).rejects.toThrow(/No UCI progress/i);
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(worker.terminated).toBe(true);
  });

  it("rejects and disposes when the worker fails to load", async () => {
    const worker = new FakeWorker();
    worker.onPost = () => queueMicrotask(() => worker.fail());
    await expect(clientFor(worker).initialize("SAFE_IMPORTED_PGN")).rejects.toThrow(/worker/i);
    expect(worker.terminated).toBe(true);
  });

  it("times out and disposes a silent worker", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const pending = clientFor(worker, 25).initialize("SAFE_IMPORTED_PGN");
    const rejection = expect(pending).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(worker.terminated).toBe(true);
  });

  it("rejects a best move without evaluation lines", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker);
    await client.initialize("SAFE_IMPORTED_PGN");
    const prior = worker.onPost;
    worker.onPost = (message) => {
      prior?.(message);
      if (message.type === "COMMAND" && message.command.startsWith("go ")) {
        queueMicrotask(() => worker.emit({ type: "LINE", line: "bestmove e2e4" }));
      }
    };
    await expect(client.analyze({ fen: "startpos", depth: 1 })).rejects.toThrow(/evaluation data/i);
    client.dispose();
  });

  it("sends stop and rejects with AbortError when analysis is cancelled", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker);
    await client.initialize("SAFE_IMPORTED_PGN");
    worker.onPost = (message) => {
      if (message.type === "COMMAND" && message.command === "stop") queueMicrotask(() => {
        worker.emit({ type: "LINE", line: "info depth 6 multipv 1 score cp 12 pv e2e4 e7e5" });
        worker.emit({ type: "LINE", line: "bestmove e2e4" });
      });
    };
    const controller = new AbortController();
    const pending = client.analyze({ fen: "startpos", depth: 6 }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.posted).toContainEqual({ type: "COMMAND", command: "stop" });
    client.dispose();
  });

  it("does not start search when the signal is already aborted", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker);
    await client.initialize("SAFE_IMPORTED_PGN");
    const controller = new AbortController();
    controller.abort();
    await expect(client.analyze({ fen: "startpos", depth: 6 }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.posted.some((message) => message.type === "COMMAND" && message.command.startsWith("go "))).toBe(false);
    client.dispose();
  });

  it("terminates a fatal worker and can initialize a replacement", async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    handshake(first);
    handshake(second);
    const workers = [first, second];
    const client = new StockfishClient({ workerFactory: () => workers.shift() as unknown as Worker, startupTimeoutMs: 100, analysisTimeoutMs: 100 });
    await client.initialize("SAFE_IMPORTED_PGN");
    first.emit({ type: "ERROR", message: "WASM trap" });
    expect(first.terminated).toBe(true);
    await client.initialize("SAFE_IMPORTED_PGN");
    expect(second.posted).toContainEqual({ type: "COMMAND", command: "uci" });
    client.dispose();
  });
});

describe("StockfishClient search queue", () => {
  it("queues a new search behind an aborted one instead of failing with 'already analyzing'", async () => {
    const worker = new FakeWorker();
    handshake(worker);
    const client = clientFor(worker, 1000, 3000);
    await client.initialize("SAFE_IMPORTED_PGN");
    const goCommands: string[] = [];
    const infoLine = "info depth 10 seldepth 12 multipv 1 score cp 20 nodes 1000 nps 100000 pv e2e4 e7e5";
    const base = worker.onPost;
    worker.onPost = (message) => {
      base?.(message);
      if (message.type === "COMMAND" && message.command.startsWith("go ")) goCommands.push(message.command);
    };
    const first = new AbortController();
    const firstResult = client.analyze({ fen: "8/8/8/8/8/8/8/K1k5 w - - 0 1", depth: 5 }, first.signal);
    await Promise.resolve(); await Promise.resolve();
    first.abort();
    const second = client.analyze({ fen: "8/8/8/8/8/8/8/K1k5 b - - 0 1", depth: 5 });
    const settled = expect(firstResult).rejects.toMatchObject({ name: "AbortError" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(goCommands).toHaveLength(1); // the second search has not started while the first is still stopping
    worker.emit({ type: "LINE", line: infoLine }); worker.emit({ type: "LINE", line: "bestmove e2e4" });
    await settled;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(goCommands).toHaveLength(2);
    worker.emit({ type: "LINE", line: infoLine }); worker.emit({ type: "LINE", line: "bestmove e7e5" });
    await expect(second).resolves.toMatchObject({ bestMove: "e7e5" });
  });
});
