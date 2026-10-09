const USERNAME_KEY = "chesscom-username";
const SEEN_KEY = "chesscom-last-seen-game";

export async function getChessComUsername(): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.storage) return "";
  const value = (await chrome.storage.local.get(USERNAME_KEY))[USERNAME_KEY];
  return typeof value === "string" ? value : "";
}
export async function saveChessComUsername(username: string): Promise<void> { await chrome.storage.local.set({ [USERNAME_KEY]: username.trim() }); }
export async function getSeenGameKey(): Promise<string> { return ((await chrome.storage.local.get(SEEN_KEY))[SEEN_KEY] as string | undefined) ?? ""; }
export async function markGameSeen(key: string): Promise<void> { await chrome.storage.local.set({ [SEEN_KEY]: key }); }
export const latestGameKey = (game: { gameId?: string; url: string; endTime: number }) => game.gameId ?? `${game.url}:${game.endTime}`;
