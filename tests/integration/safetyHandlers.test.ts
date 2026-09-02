import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionMessage } from "../../src/background/messages";
import type { EngineWorkerInput, EngineWorkerOutput } from "../../src/engine/engineTypes";

type RuntimeListener = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => boolean | void;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("registered service-worker safety boundary", () => {
  it.each([
    ["LIVE_GAME", false],
    ["UNKNOWN", false],
    ["SAFE_COMPLETED_GAME", true],
    ["SAFE_IMPORTED_PGN", true],
  ] as const)("handles a direct START_REVIEW message for %s", async (safetyState, expectedOk) => {
    let listener: RuntimeListener | undefined;
    const runtime = {
      getURL: (path: string) => `chrome-extension://test/${path}`,
      onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } },
    };
    vi.stubGlobal("chrome", {
      runtime,
      storage: { session: { set: vi.fn(async () => undefined), get: vi.fn(async () => ({})), remove: vi.fn(async () => undefined) } },
      tabs: { create: vi.fn(async () => undefined) },
    });
    await import("../../src/background/serviceWorker");
    expect(listener).toBeTypeOf("function");
    const response = await new Promise<{ ok: boolean; token?: string }>((resolve) => {
      listener?.({ type: "START_REVIEW", pgn: "1. e4 e5 *", safetyState } satisfies ExtensionMessage, {} as chrome.runtime.MessageSender, (value) => resolve(value as { ok: boolean; token?: string }));
    });
    expect(response.ok).toBe(expectedOk);
    expect(Boolean(response.token)).toBe(expectedOk);
  });

  it.each([
    ["LIVE_GAME", false], ["UNKNOWN", false], ["SAFE_COMPLETED_GAME", true], ["SAFE_IMPORTED_PGN", true],
  ] as const)("controls durable offscreen jobs for %s", async (safetyState, expectedOk) => {
    let listener: RuntimeListener | undefined; const session = new Map<string, unknown>(); const createDocument = vi.fn(async () => undefined); const sendMessage = vi.fn(async (value: unknown) => { void value; return { ok: true }; });
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage, onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: {
        local: { get: vi.fn(async () => ({ settings: { cachePreviousReviews: false } })) },
        session: { get: vi.fn(async (key: string) => ({ [key]: session.get(key) })), set: vi.fn(async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => session.set(key, value)); }), remove: vi.fn(async (key: string) => { session.delete(key); }) },
      },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(async () => false), createDocument },
      tabs: { create: vi.fn(async () => undefined) },
    });
    await import("../../src/background/serviceWorker");
    const response = await new Promise<{ ok: boolean; analysisId?: string }>((resolve) => listener?.({ type: "START_ANALYSIS", pgn: "1. e4 e5 *", safetyState } satisfies ExtensionMessage, {} as chrome.runtime.MessageSender, (value) => resolve(value as { ok: boolean; analysisId?: string })));
    expect(response.ok).toBe(expectedOk); expect(createDocument).toHaveBeenCalledTimes(expectedOk ? 1 : 0);
    expect(sendMessage.mock.calls.some(([value]) => (
      typeof value === "object"
      && value !== null
      && "type" in value
      && value.type === "RUN_ANALYSIS"
    ))).toBe(expectedOk);
  });

  it("attaches a repeated request without dispatching a second engine run", async () => {
    let listener: RuntimeListener | undefined;
    const session = new Map<string, unknown>();
    const sendMessage = vi.fn(async (value: unknown) => { void value; return { ok: true }; });
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage, onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: {
        local: { get: vi.fn(async () => ({ settings: { cachePreviousReviews: false } })) },
        session: { get: vi.fn(async (key: string) => ({ [key]: session.get(key) })), set: vi.fn(async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => session.set(key, value)); }), remove: vi.fn(async (key: string) => { session.delete(key); }) },
      },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(async () => false), createDocument: vi.fn(async () => undefined) },
      tabs: { create: vi.fn(async () => undefined) },
    });
    await import("../../src/background/serviceWorker");
    const start = () => new Promise<{ ok: boolean; attached?: boolean }>((resolve) => listener?.(
      { type: "START_ANALYSIS", pgn: "1. e4 e5 *", safetyState: "SAFE_IMPORTED_PGN" } satisfies ExtensionMessage,
      {} as chrome.runtime.MessageSender,
      (value) => resolve(value as { ok: boolean; attached?: boolean }),
    ));
    const first = await start();
    const second = await start();
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: true, attached: true });
    expect(sendMessage.mock.calls.filter(([value]) => (
      typeof value === "object" && value !== null && "type" in value && value.type === "RUN_ANALYSIS"
    ))).toHaveLength(1);
  });
});

describe("engine worker safety boundary", () => {
  it.each(["LIVE_GAME", "UNKNOWN"] as const)("rejects direct initialization and commands for %s", async (safetyState) => {
    const output: EngineWorkerOutput[] = [];
    const scope = { postMessage: (message: EngineWorkerOutput) => output.push(message), onmessage: null as ((event: MessageEvent<EngineWorkerInput>) => void) | null };
    const workerFactory = vi.fn();
    vi.stubGlobal("self", scope);
    vi.stubGlobal("Worker", workerFactory);
    await import("../../src/engine/stockfishWorker");
    scope.onmessage?.({ data: { type: "INITIALIZE", safetyState, engineUrl: "engine.js" } } as MessageEvent<EngineWorkerInput>);
    scope.onmessage?.({ data: { type: "COMMAND", command: "go depth 99" } } as MessageEvent<EngineWorkerInput>);
    expect(workerFactory).not.toHaveBeenCalled();
    expect(output).toHaveLength(2);
    expect(output.every((message) => message.type === "ERROR" && /blocked/.test(message.message))).toBe(true);
  });

  it.each(["SAFE_COMPLETED_GAME", "SAFE_IMPORTED_PGN"] as const)("allows direct initialization for %s", async (safetyState) => {
    const output: EngineWorkerOutput[] = [];
    const scope = { postMessage: (message: EngineWorkerOutput) => output.push(message), onmessage: null as ((event: MessageEvent<EngineWorkerInput>) => void) | null };
    const nested = { terminate: vi.fn(), postMessage: vi.fn(), onmessage: null, onerror: null };
    const WorkerConstructor = vi.fn(function WorkerConstructor() { return nested; });
    vi.stubGlobal("self", scope);
    vi.stubGlobal("Worker", WorkerConstructor);
    await import("../../src/engine/stockfishWorker");
    scope.onmessage?.({ data: { type: "INITIALIZE", safetyState, engineUrl: "engine.js" } } as MessageEvent<EngineWorkerInput>);
    expect(WorkerConstructor).toHaveBeenCalledWith("engine.js");
    expect(output).toContainEqual({ type: "READY" });
  });
});
