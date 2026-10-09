export interface CompletedGameIdentity {
  gameId?: string;
  url: string;
  whiteUsername?: string;
  blackUsername?: string;
  localUsername?: string;
  candidateUsernames?: string[];
  endedAt?: number;
  result?: string;
  timeControl?: string;
}

export function extractChessComGameId(value: string): string | undefined {
  try {
    const path = new URL(value).pathname;
    return /\/(?:analysis\/)?game(?:\/(?:live|daily))?\/(\d+)(?:\/|$)/i.exec(path)?.[1];
  } catch { return undefined; }
}

export function normalizedGameIdentityKey(identity: CompletedGameIdentity): string | undefined {
  if (identity.gameId) return `chesscom:${identity.gameId}`;
  const white = identity.whiteUsername?.trim().toLowerCase();
  const black = identity.blackUsername?.trim().toLowerCase();
  if (!white || !black || !identity.result) return undefined;
  const ended = identity.endedAt ? Math.floor(normalizeEpochMs(identity.endedAt) / 60_000) : "recent";
  return `chesscom-meta:${white}:${black}:${identity.result}:${ended}`;
}

export function normalizeEpochMs(value: number): number {
  return value < 1_000_000_000_000 ? value * 1000 : value;
}
