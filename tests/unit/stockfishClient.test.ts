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

function clientFor(worker: FakeWorker, timeoutMs = 100): StockfishClient {
  return new StockfishClient({ workerFactory: () => worker as unknown as Worker, startupTimeoutMs: timeoutMs, analysisTimeoutMs: timeoutMs });
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
      { type: "COMMAND", command: "isready" },
    ]));
    client.dispose();
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
