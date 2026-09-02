import { useEffect, useState } from "react";
import { FileUp, FolderOpen, Search, Settings } from "lucide-react";
import type { ChessComPageSnapshot } from "../adapters/chessCom/pageAdapter";

type State = "loading" | "unsupported" | "completed" | "live" | "unknown" | "extraction_failed";

export function Popup() {
  const [state, setState] = useState<State>("loading");
  const [snapshot, setSnapshot] = useState<ChessComPageSnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void inspect(); }, []);
  async function inspect() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id || !tab.url?.startsWith("https://www.chess.com/")) { setState("unsupported"); return; }
      const response = await chrome.tabs.sendMessage(tab.id, { type: "INSPECT_PAGE" }) as ChessComPageSnapshot;
      setSnapshot(response);
      if (response.safetyState === "LIVE_GAME") setState("live");
      else if (response.safetyState === "UNKNOWN") setState("unknown");
      else if (!response.pgn) setState("extraction_failed");
      else setState("completed");
    } catch { setState("unknown"); }
  }
  async function analyze() {
    if (!snapshot?.pgn || snapshot.safetyState !== "SAFE_COMPLETED_GAME") return;
    const response = await chrome.runtime.sendMessage({ type: "START_REVIEW", pgn: snapshot.pgn, safetyState: snapshot.safetyState }) as { ok: boolean; token?: string; error?: string };
    if (!response.ok || !response.token) { setError(response.error ?? "Unable to start review."); return; }
    await chrome.runtime.sendMessage({ type: "OPEN_REVIEW", token: response.token }); window.close();
  }
  const open = (suffix: string) => { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html${suffix}`) }); window.close(); };
  const copy: Record<State, { title: string; body: string }> = {
    loading: { title: "Checking this page", body: "Confirming that analysis is safe." },
    unsupported: { title: "No completed game found", body: "Open a completed Chess.com game, or import a PGN." },
    completed: { title: "Completed game ready", body: "The game result and PGN were confirmed." },
    live: { title: "Analysis disabled", body: "Analysis is unavailable while a game is in progress." },
    unknown: { title: "Game status unconfirmed", body: "Unable to confirm this game has ended. Import the PGN after the game." },
    extraction_failed: { title: "Import needed", body: "Could not read this completed game automatically. Paste the PGN instead." },
  };
  return <div className="popup"><header><span className="brand-mark">CR</span><div><strong>Chess Review Lab</strong><span>Local post-game analysis</span></div></header><main><div className={`status status-${state}`}><Search/><div><h1>{copy[state].title}</h1><p>{copy[state].body}</p></div></div>{error && <p className="popup-error">{error}</p>}{state === "completed" && <button className="primary wide" onClick={() => void analyze()}>Analyze completed game</button>}<button className="secondary wide" onClick={() => open("?import=1")}><FileUp/> Import PGN</button></main><footer><button onClick={() => open("?view=previous")}><FolderOpen/> Previous reviews</button><button aria-label="Settings" title="Settings" onClick={() => open("?view=settings")}><Settings/></button></footer></div>;
}
