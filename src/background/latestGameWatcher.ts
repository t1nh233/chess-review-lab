import { fetchLatestFinishedGame } from "../adapters/chessCom/latestGame";
import { getChessComUsername, getSeenGameKey, latestGameKey } from "../storage/chessComProfile";
import { debugLog } from "../utils/logger";

// Polls the public archive (finished games only) and badges the toolbar icon when a new game has ended.
const POLL_ALARM = "chesscom-latest-game";
const FRESH_GAME_MS = 60 * 60 * 1000;

export async function pollLatestGame(): Promise<void> {
  try {
    const username = await getChessComUsername();
    if (!username) { await chrome.action.setBadgeText({ text: "" }); return; }
    const game = await fetchLatestFinishedGame(username);
    const fresh = Boolean(game && Date.now() - game.endTime < FRESH_GAME_MS && latestGameKey(game) !== await getSeenGameKey());
    await chrome.action.setBadgeText({ text: fresh ? "NEW" : "" });
    if (fresh) await chrome.action.setBadgeBackgroundColor({ color: "#81b64c" });
  } catch (error) { debugLog("latest_game_poll_failed", { error: error instanceof Error ? error.message : String(error) }); }
}

export function startLatestGameWatcher(): void {
  if (typeof chrome === "undefined" || !chrome.alarms || !chrome.runtime?.onInstalled) return;
  const schedule = () => { void chrome.alarms.create(POLL_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 }); };
  chrome.runtime.onInstalled.addListener(schedule);
  chrome.runtime.onStartup?.addListener(schedule);
  chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === POLL_ALARM) void pollLatestGame(); });
  chrome.storage.onChanged?.addListener((changes, area) => { if (area === "local" && changes["chesscom-username"]) { schedule(); void pollLatestGame(); } });
}
