import { collectSafetyEvidence } from "./completedGameDetector";
import { extractPgn } from "./pgnExtractor";
import { detectGameSafetyState, type GameSafetyState } from "../../safety/liveGameGuard";
import { parsePgn } from "../../chess/pgn";
import { extractChessComGameId, type CompletedGameIdentity } from "./completedGameIdentity";

export interface ChessComCompletedGameMetadata extends CompletedGameIdentity {
  gameUrl: string;
  whiteName?: string;
  blackName?: string;
  whiteRating?: number;
  blackRating?: number;
  result?: string;
  termination?: string;
  moveCount?: number;
}
export interface ChessComPageHints { gameId?: string; candidateUsernames: string[] }
export interface ChessComPageSnapshot { safetyState: GameSafetyState; pgn: string | null; url: string; completedGame?: ChessComCompletedGameMetadata; hints?: ChessComPageHints }

function nodeText(doc: Document, selectors: readonly string[]): string | undefined {
  for (const selector of selectors) {
    const node = doc.querySelector<HTMLElement>(selector);
    const value = node?.dataset.username ?? node?.textContent?.trim();
    if (value) return value;
  }
  return undefined;
}

const USERNAME_SELECTORS = [
  "[data-test-element='user-tagline-username']", ".user-tagline-username", ".user-username-component", ".cc-user-username-component",
  "a[href*='chess.com/member/']", "a[href^='/member/']",
];

function candidateUsernames(doc: Document): string[] {
  const names = new Set<string>();
  for (const node of Array.from(doc.querySelectorAll<HTMLElement>(USERNAME_SELECTORS.join(",")))) {
    const href = node instanceof HTMLAnchorElement ? /\/member\/([^/?#]+)/.exec(node.getAttribute("href") ?? "")?.[1] : undefined;
    const raw = href ? decodeURIComponent(href) : node.dataset.username ?? node.textContent?.trim();
    const name = raw?.replace(/\s+/g, " ").trim();
    if (name && /^[A-Za-z0-9_-]{2,25}$/.test(name)) names.add(name);
    if (names.size >= 8) break;
  }
  return [...names];
}

function completedMetadata(doc: Document, url: string, pgn: string | null, result?: string): ChessComCompletedGameMetadata {
  const whiteUsername = nodeText(doc, ["[data-cy='white-username']", "[data-player-color='white'][data-username]", ".white-player .username"]);
  const blackUsername = nodeText(doc, ["[data-cy='black-username']", "[data-player-color='black'][data-username]", ".black-player .username"]);
  const metadata: ChessComCompletedGameMetadata = { gameId: extractChessComGameId(url), url, gameUrl: url, whiteUsername, blackUsername, candidateUsernames: candidateUsernames(doc), result };
  if (!pgn) return metadata;
  try {
    const game = parsePgn(pgn);
    return {
      ...metadata,
      whiteName: game.headers.White,
      blackName: game.headers.Black,
      whiteUsername: game.headers.White,
      blackUsername: game.headers.Black,
      whiteRating: game.whiteRating,
      blackRating: game.blackRating,
      result: game.result,
      termination: game.headers.Termination,
      timeControl: game.headers.TimeControl,
      moveCount: game.moves.length,
    };
  } catch { return metadata; }
}
export class ChessComPageAdapter {
  supports(url: string): boolean { try { return new URL(url).hostname === "www.chess.com"; } catch { return false; } }
  inspect(doc: Document, url: string): ChessComPageSnapshot {
    if (!this.supports(url)) return { safetyState: "UNKNOWN", pgn: null, url };
    const evidence = collectSafetyEvidence(doc, url);
    const safetyState = detectGameSafetyState(evidence);
    const pgn = safetyState === "SAFE_COMPLETED_GAME" ? extractPgn(doc) : null;
    const hints: ChessComPageHints = { gameId: extractChessComGameId(url), candidateUsernames: candidateUsernames(doc) };
    return { safetyState, pgn, url, hints, completedGame: safetyState === "SAFE_COMPLETED_GAME" ? completedMetadata(doc, url, pgn, evidence.explicitResult) : undefined };
  }
}
