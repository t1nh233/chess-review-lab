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
    ["LIVE_GAME", false], ["UNKNOWN", false], ["SAFE_COMPLETED_GAME", false], ["SAFE_IMPORTED_PGN", true],
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

  it("revalidates a completed Chess.com tab and starts exactly one durable run", async () => {
    let listener: RuntimeListener | undefined; const session = new Map<string, unknown>();
    const sendMessage = vi.fn(async (value: unknown) => { void value; return { ok: true }; });
    const pgn = `[Event "Completed"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1`;
    const tabSnapshot = { safetyState: "SAFE_COMPLETED_GAME", pgn, url: "https://www.chess.com/game/live/123", completedGame: { gameId: "123", url: "https://www.chess.com/game/live/123", gameUrl: "https://www.chess.com/game/live/123", result: "0-1", moveCount: 4 } };
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage, onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: { local: { get: vi.fn(async (key: string) => key === "settings" ? { settings: { cachePreviousReviews: false } } : {}), set: vi.fn(async () => undefined) }, session: { get: vi.fn(async (key: string) => ({ [key]: session.get(key) })), set: vi.fn(async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => session.set(key, value)); }), remove: vi.fn(async (key: string) => { session.delete(key); }) } },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(async () => false), createDocument: vi.fn(async () => undefined) },
      tabs: { sendMessage: vi.fn(async () => tabSnapshot), create: vi.fn(async () => undefined) },
    });
    await import("../../src/background/serviceWorker");
    const start = () => new Promise<{ ok: boolean; attached?: boolean }>((resolve) => listener?.(
      { type: "START_COMPLETED_ANALYSIS", tabId: 9, expectedGameId: "123" } satisfies ExtensionMessage, {} as chrome.runtime.MessageSender,
      (value) => resolve(value as { ok: boolean; attached?: boolean }),
    ));
    expect((await start()).ok).toBe(true);
    expect(await start()).toMatchObject({ ok: true, attached: true });
    expect(sendMessage.mock.calls.filter(([value]) => typeof value === "object" && value !== null && "type" in value && value.type === "RUN_ANALYSIS")).toHaveLength(1);
  });

  it.each(["LIVE_GAME", "UNKNOWN"] as const)("rejects a completed-game request when tab revalidation reports %s", async (safetyState) => {
    let listener: RuntimeListener | undefined; const createDocument = vi.fn(); const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage: vi.fn(), onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: { local: { get: vi.fn(async () => ({})) }, session: { get: vi.fn(async () => ({})), set: vi.fn(), remove: vi.fn() } },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(async () => false), createDocument },
      tabs: { sendMessage: vi.fn(async () => ({ safetyState, pgn: null, url: "https://www.chess.com/game/live/123" })), create: vi.fn() },
    });
    await import("../../src/background/serviceWorker");
    const response = await new Promise<{ ok: boolean }>((resolve) => listener?.(
      { type: "START_COMPLETED_ANALYSIS", tabId: 9, expectedGameId: "123" } satisfies ExtensionMessage, {} as chrome.runtime.MessageSender,
      (value) => resolve(value as { ok: boolean }),
    ));
    expect(response.ok).toBe(false); expect(fetchFn).not.toHaveBeenCalled(); expect(createDocument).not.toHaveBeenCalled();
  });

  it("finishes PGN acquisition after the popup closes without starting Stockfish", async () => {
    let listener: RuntimeListener | undefined;
    const local = new Map<string, unknown>(); const session = new Map<string, unknown>();
    const createDocument = vi.fn(); const runtimeSend = vi.fn();
    const pgn = `[Event "Completed"]\n[Site "https://www.chess.com/game/live/123"]\n[White "Alice"]\n[Black "Bob"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1`;
    const metadata = { gameId: "123", url: "https://www.chess.com/game/live/123", gameUrl: "https://www.chess.com/game/live/123", whiteUsername: "Alice", blackUsername: "Bob", result: "0-1" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ games: [{ url: metadata.url, pgn }] }), { status: 200 })));
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage: runtimeSend, onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: {
        local: { get: vi.fn(async (key: string) => key === "settings" ? { settings: { cachePreviousReviews: false } } : { [key]: local.get(key) }), set: vi.fn(async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => local.set(key, value)); }) },
        session: { get: vi.fn(async (key: string) => ({ [key]: session.get(key) })), set: vi.fn(async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => session.set(key, value)); }), remove: vi.fn() },
      },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(), createDocument },
      tabs: { create: vi.fn(), sendMessage: vi.fn(async () => ({ safetyState: "SAFE_COMPLETED_GAME", pgn: null, url: metadata.url, completedGame: metadata })) },
    });
    await import("../../src/background/serviceWorker");
    await new Promise<void>((resolve) => listener?.({ type: "GAME_COMPLETED_AVAILABLE", metadata } satisfies ExtensionMessage, { tab: { id: 9 } } as chrome.runtime.MessageSender, () => resolve()));
    await vi.waitFor(() => expect((local.get("completed-pgn-state:chesscom:123") as any)?.result.status).toBe("available"));
    const reopened = await new Promise<any>((resolve) => listener?.({ type: "GET_COMPLETED_ANALYSIS", tabId: 9, expectedGameId: "123" } satisfies ExtensionMessage, {} as chrome.runtime.MessageSender, resolve));
    expect(reopened.acquisition).toMatchObject({ status: "available", pgn });
    expect(createDocument).not.toHaveBeenCalled();
    expect(runtimeSend).not.toHaveBeenCalled();
  });

  it("records a completion notification without starting the engine", async () => {
    let listener: RuntimeListener | undefined; const createDocument = vi.fn(); const runtimeSend = vi.fn(); const sessionSet = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage: runtimeSend, onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: { local: { get: vi.fn() }, session: { get: vi.fn(), set: sessionSet, remove: vi.fn() } },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(), createDocument }, tabs: { create: vi.fn(), sendMessage: vi.fn() },
    });
    await import("../../src/background/serviceWorker");
    const metadata = { gameId: "123", url: "https://www.chess.com/game/live/123", gameUrl: "https://www.chess.com/game/live/123", result: "0-1" };
    const response = await new Promise<{ ok: boolean }>((resolve) => listener?.(
      { type: "GAME_COMPLETED_AVAILABLE", metadata } satisfies ExtensionMessage, { tab: { id: 9 } } as chrome.runtime.MessageSender,
      (value) => resolve(value as { ok: boolean }),
    ));
    expect(response.ok).toBe(true); expect(sessionSet).toHaveBeenCalledWith({ "completed-game:9": metadata });
    expect(createDocument).not.toHaveBeenCalled(); expect(runtimeSend).not.toHaveBeenCalled();
  });

  it("dismisses a completed popup session without deleting the stored review job", async () => {
    let listener: RuntimeListener | undefined;
    const session = new Map<string, unknown>();
    const job = {
      analysisId: "done-1", hostToken: "cached", fingerprint: "fingerprint", pgn: "1. e4 e5 *",
      safetyState: "SAFE_IMPORTED_PGN", summary: { analysisId: "done-1", status: "completed", currentPly: 2, totalPlies: 2, whiteName: "White", blackName: "Black", moves: [] },
    };
    session.set("lastAnalysisId", "done-1"); session.set("analysis-job:done-1", job);
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage: vi.fn(async () => ({ ok: true })), onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: {
        local: { get: vi.fn(async () => ({})) },
        session: { get: vi.fn(async (key: string) => ({ [key]: session.get(key) })), set: vi.fn(async () => undefined), remove: vi.fn(async (key: string) => { session.delete(key); }) },
      },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(async () => true), createDocument: vi.fn(async () => undefined) },
      tabs: { create: vi.fn(async () => undefined) },
    });
    await import("../../src/background/serviceWorker");
    const response = await new Promise<{ ok: boolean }>((resolve) => listener?.(
      { type: "DISMISS_ANALYSIS", analysisId: "done-1" } satisfies ExtensionMessage,
      {} as chrome.runtime.MessageSender,
      (value) => resolve(value as { ok: boolean }),
    ));
    expect(response.ok).toBe(true);
    expect(session.has("lastAnalysisId")).toBe(false);
    expect(session.get("analysis-job:done-1")).toBe(job);
    const lateUpdate = await new Promise<{ ok: boolean }>((resolve) => listener?.(
      { type: "ANALYSIS_UPDATE", analysisId: "done-1", hostToken: "cached", summary: { ...job.summary, status: "cancelled" } } satisfies ExtensionMessage,
      { id: "test", url: "chrome-extension://test/offscreen.html" } as chrome.runtime.MessageSender,
      (value) => resolve(value as { ok: boolean }),
    ));
    expect(lateUpdate.ok).toBe(true);
    expect(session.has("lastAnalysisId")).toBe(false);
  });

  it("refuses to detach an active job before it is cancelled", async () => {
    let listener: RuntimeListener | undefined;
    const session = new Map<string, unknown>();
    session.set("lastAnalysisId", "active-1");
    session.set("analysis-job:active-1", {
      analysisId: "active-1", hostToken: "token", fingerprint: "fingerprint", pgn: "1. e4 e5 *", safetyState: "SAFE_IMPORTED_PGN",
      summary: { analysisId: "active-1", status: "analyzing", currentPly: 1, totalPlies: 2, whiteName: "White", blackName: "Black", moves: [] },
    });
    vi.stubGlobal("chrome", {
      runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, sendMessage: vi.fn(async () => ({ ok: true })), onMessage: { addListener: (registered: RuntimeListener) => { listener = registered; } } },
      storage: { local: { get: vi.fn(async () => ({})) }, session: { get: vi.fn(async (key: string) => ({ [key]: session.get(key) })), set: vi.fn(async () => undefined), remove: vi.fn(async (key: string) => { session.delete(key); }) } },
      offscreen: { Reason: { WORKERS: "WORKERS" }, hasDocument: vi.fn(async () => true), createDocument: vi.fn(async () => undefined) }, tabs: { create: vi.fn(async () => undefined) },
    });
    await import("../../src/background/serviceWorker");
    const response = await new Promise<{ ok: boolean; error?: string }>((resolve) => listener?.(
      { type: "DISMISS_ANALYSIS", analysisId: "active-1" } satisfies ExtensionMessage, {} as chrome.runtime.MessageSender,
      (value) => resolve(value as { ok: boolean; error?: string }),
    ));
    expect(response).toMatchObject({ ok: false }); expect(response.error).toMatch(/Cancel/);
    expect(session.get("lastAnalysisId")).toBe("active-1");
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
