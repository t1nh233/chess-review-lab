import { parsePgn } from "../../chess/pgn";
import { extractChessComGameId } from "./completedGameIdentity";

/**
 * Lists a player's finished games through Chess.com's public archive.
 * The archive lists finished games only, so a live game can never be returned.
 */
export interface LatestGame {
  gameId?: string;
  url: string;
  pgn: string;
  endTime: number;
  white: string;
  black: string;
  result: string;
  timeControl?: string;
  timeClass?: string;
  userColor: "white" | "black";
  opponent: string;
  userRating?: number;
  opponentRating?: number;
}

interface ArchiveGame {
  url?: string; pgn?: string; end_time?: number; time_control?: string; time_class?: string; rules?: string;
  white?: { username?: string; rating?: number }; black?: { username?: string; rating?: number };
}

const USERNAME = /^[A-Za-z0-9_-]{2,25}$/;
export const isValidChessComUsername = (value: string) => USERNAME.test(value.trim());

async function getJson<T>(url: string, fetchFn: typeof fetch): Promise<T | undefined> {
  const response = await fetchFn(url, { headers: { Accept: "application/json" } });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Chess.com PubAPI returned HTTP ${response.status}.`);
  return await response.json() as T;
}

function toLatestGame(game: ArchiveGame, name: string): LatestGame | undefined {
  if (!game.pgn || !game.end_time || (game.rules && game.rules !== "chess")) return undefined;
  let parsed;
  try { parsed = parsePgn(game.pgn); } catch { return undefined; }
  if (!parsed.moves.length || !parsed.result) return undefined;
  const white = game.white?.username ?? parsed.headers.White ?? "White";
  const black = game.black?.username ?? parsed.headers.Black ?? "Black";
  const userColor = white.toLowerCase() === name ? "white" : "black";
  const link = game.url ?? parsed.headers.Link ?? "";
  return {
    gameId: extractChessComGameId(link), url: link, pgn: game.pgn, endTime: game.end_time * 1000, white, black, result: parsed.result,
    timeControl: game.time_control, timeClass: game.time_class, userColor, opponent: userColor === "white" ? black : white,
    userRating: (userColor === "white" ? game.white : game.black)?.rating,
    opponentRating: (userColor === "white" ? game.black : game.white)?.rating,
  };
}

export interface GamesPage { games: LatestGame[]; nextPage?: number }

/** One monthly archive per page, newest first (page 0 = newest month). Games inside a page are newest first. */
export async function fetchGamesPage(username: string, page: number, fetchFn: typeof fetch = fetch): Promise<GamesPage> {
  const name = username.trim().toLowerCase();
  if (!USERNAME.test(name)) throw new Error("Invalid Chess.com username.");
  const archives = (await getJson<{ archives?: string[] }>(`https://api.chess.com/pub/player/${encodeURIComponent(name)}/games/archives`, fetchFn))?.archives ?? [];
  const archiveUrl = archives[archives.length - 1 - page];
  if (!archiveUrl || !archiveUrl.startsWith("https://api.chess.com/pub/player/")) return { games: [] };
  const raw = (await getJson<{ games?: ArchiveGame[] }>(archiveUrl, fetchFn))?.games ?? [];
  const games = raw.map((game) => toLatestGame(game, name)).filter((game): game is LatestGame => Boolean(game)).sort((a, b) => b.endTime - a.endTime);
  return { games, nextPage: archives.length - 1 - page > 0 ? page + 1 : undefined };
}

export async function fetchLatestFinishedGame(username: string, fetchFn: typeof fetch = fetch): Promise<LatestGame | undefined> {
  // The newest archive can be empty at a month boundary, so look back at most two months.
  for (let page = 0; page < 2; page += 1) {
    const result = await fetchGamesPage(username, page, fetchFn);
    if (result.games[0]) return result.games[0];
    if (result.nextPage === undefined) break;
  }
  return undefined;
}
