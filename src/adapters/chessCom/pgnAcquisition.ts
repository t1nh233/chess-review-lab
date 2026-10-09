import { parsePgn } from "../../chess/pgn";
import { extractChessComGameId, normalizeEpochMs, normalizedGameIdentityKey, type CompletedGameIdentity } from "./completedGameIdentity";

export type PgnAcquisitionResult =
  | { status: "available"; source: "page" | "pubapi"; pgn: string }
  | { status: "pending" }
  | { status: "unavailable"; reason: string }
  | { status: "error"; reason: string };

export interface ChessComApiGame {
  url?: string;
  pgn?: string;
  end_time?: number;
  time_control?: string;
  white?: { username?: string; result?: string };
  black?: { username?: string; result?: string };
}

export interface PgnCache {
  get(key: string): Promise<string | undefined>;
  set(key: string, pgn: string): Promise<void>;
}

export interface AcquisitionOptions {
  pagePgn?: string | null;
  fetchFn?: typeof fetch;
  cache?: PgnCache;
  now?: () => number;
  attempt?: number;
  maxAttempts?: number;
}

export interface RetryAcquisitionOptions extends Omit<AcquisitionOptions, "attempt" | "maxAttempts"> {
  retryDelaysMs?: readonly number[];
  sleep?: (delayMs: number) => Promise<void>;
  onResult?: (result: PgnAcquisitionResult, attempt: number) => void | Promise<void>;
}

export const DEFAULT_PGN_RETRY_DELAYS_MS = [1_500, 3_500, 7_000] as const;

const same = (left?: string, right?: string) => Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());

function resultFromApiGame(game: ChessComApiGame): string | undefined {
  const result = game.pgn ? /\[Result\s+"([^"]+)"\]/.exec(game.pgn)?.[1] : undefined;
  if (result) return result;
  if (game.white?.result === "win") return "1-0";
  if (game.black?.result === "win") return "0-1";
  if (game.white?.result && game.black?.result) return "1/2-1/2";
  return undefined;
}

export function selectExactApiGame(games: readonly ChessComApiGame[], identity: CompletedGameIdentity): ChessComApiGame | undefined {
  if (identity.gameId) return games.find((game) => extractChessComGameId(game.url ?? "") === identity.gameId);
  const matches = games.filter((game) => {
    if (!same(game.white?.username, identity.whiteUsername) || !same(game.black?.username, identity.blackUsername)) return false;
    if (identity.result && resultFromApiGame(game) !== identity.result) return false;
    if (identity.timeControl && game.time_control !== identity.timeControl) return false;
    if (identity.endedAt && (!game.end_time || Math.abs(normalizeEpochMs(game.end_time) - normalizeEpochMs(identity.endedAt)) > 300_000)) return false;
    return true;
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function validateAcquiredPgn(pgn: string, identity: CompletedGameIdentity, apiUrl?: string): string {
  const parsed = parsePgn(pgn);
  if (!parsed.moves.length) throw new Error("Completed game PGN has no legal moves.");
  const linkedIds = [apiUrl, parsed.headers.Link, parsed.headers.Site].filter((value): value is string => Boolean(value)).map(extractChessComGameId).filter((value): value is string => Boolean(value));
  // Page-scraped names/results are best-effort; an exact game-id link is stronger evidence.
  const exactIdMatch = Boolean(identity.gameId && linkedIds.length && linkedIds.every((linkedId) => linkedId === identity.gameId));
  if (!exactIdMatch) {
    if (identity.whiteUsername && !same(parsed.headers.White, identity.whiteUsername)) throw new Error("PGN White player does not match the completed game.");
    if (identity.blackUsername && !same(parsed.headers.Black, identity.blackUsername)) throw new Error("PGN Black player does not match the completed game.");
    if (identity.result && parsed.result !== identity.result) throw new Error("PGN result does not match the completed game.");
  }
  if (identity.gameId && linkedIds.some((linkedId) => linkedId !== identity.gameId)) throw new Error("PGN belongs to a different Chess.com game.");
  return pgn;
}

export function monthlyArchiveUrl(username: string, identity: CompletedGameIdentity, now: () => number = Date.now): string {
  const date = new Date(identity.endedAt ? normalizeEpochMs(identity.endedAt) : now());
  return `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function candidateUsernames(identity: CompletedGameIdentity): string[] {
  const seen = new Set<string>();
  return [identity.localUsername, identity.whiteUsername, identity.blackUsername, ...(identity.candidateUsernames ?? [])]
    .filter((name): name is string => Boolean(name?.trim()))
    .filter((name) => { const key = name.trim().toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}

function archiveUrls(username: string, identity: CompletedGameIdentity, now: () => number): string[] {
  const urls = [monthlyArchiveUrl(username, identity, now)];
  const date = new Date(identity.endedAt ? normalizeEpochMs(identity.endedAt) : now());
  // A game finished just before UTC midnight on the month boundary may still live in the previous archive.
  if (!identity.endedAt && date.getUTCDate() <= 2) {
    const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
    urls.push(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${previous.getUTCFullYear()}/${String(previous.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return urls;
}

export async function acquireCompletedGamePgn(identity: CompletedGameIdentity, options: AcquisitionOptions = {}): Promise<PgnAcquisitionResult> {
  const key = normalizedGameIdentityKey(identity);
  if (key && options.cache) {
    const cached = await options.cache.get(key);
    if (cached) {
      try { return { status: "available", source: "pubapi", pgn: validateAcquiredPgn(cached, identity) }; }
      catch { /* Ignore stale cache entries and continue. */ }
    }
  }
  if (options.pagePgn) {
    try {
      const pgn = validateAcquiredPgn(options.pagePgn, identity);
      if (key && options.cache) await options.cache.set(key, pgn);
      return { status: "available", source: "page", pgn };
    } catch { /* Fall through to the public archive. */ }
  }
  const usernames = candidateUsernames(identity);
  if (!usernames.length) return { status: "unavailable", reason: "No player username is available for the public archive lookup." };
  const lastAttempt = (options.attempt ?? 0) + 1 >= (options.maxAttempts ?? 4);
  const notYet: PgnAcquisitionResult = lastAttempt ? { status: "unavailable", reason: "The exact completed game is not yet present in the public archive." } : { status: "pending" };
  let failure: PgnAcquisitionResult | undefined;
  for (const username of usernames) {
    for (const url of archiveUrls(username, identity, options.now ?? Date.now)) {
      try {
        const response = await (options.fetchFn ?? fetch)(url, { headers: { Accept: "application/json" } });
        if (!response.ok) { if (response.status !== 404) failure = { status: "error", reason: `Chess.com PubAPI returned HTTP ${response.status}.` }; continue; }
        const payload = await response.json() as { games?: ChessComApiGame[] };
        const match = selectExactApiGame(Array.isArray(payload.games) ? payload.games : [], identity);
        if (!match) continue;
        if (!match.pgn) { failure = { status: "error", reason: "The matched public game did not contain PGN." }; continue; }
        const pgn = validateAcquiredPgn(match.pgn, identity, match.url);
        if (key && options.cache) await options.cache.set(key, pgn);
        return { status: "available", source: "pubapi", pgn };
      } catch (error) {
        failure = { status: "error", reason: error instanceof Error ? error.message : "Unable to read the Chess.com public archive." };
      }
    }
  }
  return failure ?? notYet;
}

export async function acquireCompletedGamePgnWithRetry(
  identity: CompletedGameIdentity,
  options: RetryAcquisitionOptions = {},
): Promise<PgnAcquisitionResult> {
  const delays = options.retryDelaysMs ?? DEFAULT_PGN_RETRY_DELAYS_MS;
  const maxAttempts = delays.length + 1;
  const sleep = options.sleep ?? ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await acquireCompletedGamePgn(identity, { ...options, attempt, maxAttempts });
    await options.onResult?.(result, attempt);
    if (result.status !== "pending") return result;
    if (attempt < delays.length) await sleep(delays[attempt]);
  }
  return { status: "unavailable", reason: "The exact completed game is not yet present in the public archive." };
}
