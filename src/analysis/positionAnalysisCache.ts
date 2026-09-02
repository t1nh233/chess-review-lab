import type { EngineAnalysisResult } from "../engine/engineTypes";

export interface PositionCacheRequest {
  fen: string;
  engineVersion: string;
  engineMode: string;
  depth: number;
  multiPv: number;
}

interface Entry extends PositionCacheRequest { result: EngineAnalysisResult }

function normalizedFen(fen: string): string {
  return fen.trim().replace(/\s+/g, " ");
}

export class PositionAnalysisCache {
  private readonly entries = new Map<string, Entry>();

  get(request: PositionCacheRequest): EngineAnalysisResult | undefined {
    const prefix = `${normalizedFen(request.fen)}|${request.engineVersion}|${request.engineMode}|`;
    let best: Entry | undefined;
    for (const [key, entry] of this.entries) {
      if (!key.startsWith(prefix) || entry.depth < request.depth || entry.multiPv < request.multiPv) continue;
      if (!best || entry.depth < best.depth || entry.multiPv < best.multiPv) best = entry;
    }
    return best?.result;
  }

  set(request: PositionCacheRequest, result: EngineAnalysisResult): void {
    const key = `${normalizedFen(request.fen)}|${request.engineVersion}|${request.engineMode}|${request.depth}|${request.multiPv}`;
    this.entries.set(key, { ...request, fen: normalizedFen(request.fen), result });
  }

  clear(): void { this.entries.clear(); }
}
