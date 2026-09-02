/// <reference lib="webworker" />
import type { EngineWorkerInput, EngineWorkerOutput } from "./engineTypes";
import { isAnalysisAllowed } from "../safety/liveGameGuard";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let engine: Worker | null = null;
let authorized = false;
const send = (message: EngineWorkerOutput) => workerScope.postMessage(message);

workerScope.onmessage = (event: MessageEvent<EngineWorkerInput>) => {
  const message = event.data;
  if (!message || typeof message !== "object" || typeof message.type !== "string") {
    send({ type: "ERROR", message: "Malformed engine worker message." });
    return;
  }
  if (message.type === "INITIALIZE") {
    authorized = isAnalysisAllowed(message.safetyState);
    if (!authorized) {
      send({ type: "ERROR", message: "Analysis blocked by the live-game guard." });
      return;
    }
    try {
      engine?.terminate();
      engine = new Worker(message.engineUrl);
      engine.onmessage = (engineEvent: MessageEvent<string>) => send({ type: "LINE", line: String(engineEvent.data) });
      engine.onerror = () => send({ type: "ERROR", message: "Stockfish worker failed." });
      send({ type: "READY" });
    } catch {
      send({ type: "ERROR", message: "Stockfish failed to initialize." });
    }
    return;
  }
  if (message.type === "COMMAND") {
    if (!authorized || !engine) {
      send({ type: "ERROR", message: "Analysis blocked by the live-game guard." });
      return;
    }
    engine.postMessage(message.command);
    return;
  }
  engine?.terminate();
  engine = null;
  authorized = false;
};
