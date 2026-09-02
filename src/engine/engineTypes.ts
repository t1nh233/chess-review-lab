import type { GameSafetyState } from "../safety/liveGameGuard";

export interface NormalizedEval { cp?: number; mate?: number }
export interface EngineAnalysisRequest { fen: string; depth?: number; movetimeMs?: number; multiPv?: number }
export interface EngineLine { multipv: number; depth: number; scoreCp?: number; mate?: number; moves: string[] }
export interface EngineAnalysisResult { bestMove: string; depth: number; lines: EngineLine[] }
export interface ChessEngine {
  initialize(safetyState: GameSafetyState): Promise<void>;
  analyze(request: EngineAnalysisRequest, signal?: AbortSignal): Promise<EngineAnalysisResult>;
  stop(): Promise<void>;
  dispose(): void;
}

export type EngineWorkerInput =
  | { type: "INITIALIZE"; safetyState: GameSafetyState; engineUrl: string }
  | { type: "COMMAND"; command: string }
  | { type: "DISPOSE" };
export type EngineWorkerOutput =
  | { type: "READY" }
  | { type: "LINE"; line: string }
  | { type: "ERROR"; message: string };
