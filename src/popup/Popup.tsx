import { useEffect, useState } from "react";
import { FolderOpen, Lock, Settings } from "lucide-react";
import type { ChessComPageSnapshot } from "../adapters/chessCom/pageAdapter";
import { parsePgn } from "../chess/pgn";
import { Mascot, type MascotMood } from "../components/Mascot";
import { vi } from "../i18n/vi";
import { ImportPanel } from "./ImportPanel";
import { PopupSummaryView } from "./PopupSummaryView";
import { type ReviewSummary } from "./reviewSummary";
import { exitPopupAnalysis } from "./popupSession";
import { ThemeToggle } from "../components/ThemeToggle";
import { LatestGameCard } from "./LatestGameCard";
import type { PgnAcquisitionResult } from "../adapters/chessCom/pgnAcquisition";

type PageState = "loading" | "unsupported" | "completed" | "acquiring" | "pgn_unavailable" | "live" | "unknown";
type CompletedResponse = { ok: boolean; summary?: ReviewSummary; cached?: boolean; attached?: boolean; acquisition?: PgnAcquisitionResult; error?: string };
async function message<T>(value: unknown): Promise<T> { return chrome.runtime.sendMessage(value) as Promise<T>; }

export { PopupSummaryView };

export function Popup() {
  const [pageState, setPageState] = useState<PageState>("loading"); const [snapshot, setSnapshot] = useState<ChessComPageSnapshot | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [reopeningExisting, setReopeningExisting] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null); const [error, setError] = useState("");
  const summaryId = summary?.analysisId; const summaryStatus = summary?.status;
  useEffect(() => { void (async () => { const active = await message<{ summary?: ReviewSummary }>({ type: "GET_ACTIVE_ANALYSIS" }); if (active.summary) { setSummary(active.summary); setReopeningExisting(active.summary.status === "completed"); } else await inspect(); })(); }, []);
  useEffect(() => {
    if (!summaryId || !summaryStatus || !["queued", "analyzing"].includes(summaryStatus)) return;
    const timer = setInterval(() => { void message<{ ok: boolean; summary?: ReviewSummary }>({ type: "GET_ANALYSIS_STATE", analysisId: summaryId }).then((response) => { if (response.summary) setSummary(response.summary); }); }, 300);
    return () => clearInterval(timer);
  }, [summaryId, summaryStatus]);
  useEffect(() => {
    if (pageState !== "acquiring" || !activeTabId || summary) return;
    const timer = setInterval(() => { void message<CompletedResponse>({ type: "GET_COMPLETED_ANALYSIS", tabId: activeTabId, expectedGameId: snapshot?.completedGame?.gameId }).then(applyCompletedResponse); }, 500);
    return () => clearInterval(timer);
  }, [pageState, activeTabId, snapshot?.completedGame?.gameId, summary]);

  function applyCompletedResponse(response: CompletedResponse) {
    if (response.summary) { setSummary(response.summary); setReopeningExisting(response.summary.status === "completed"); return; }
    if (response.acquisition?.status === "available") setPageState("completed");
    else if (response.acquisition?.status === "pending") setPageState("acquiring");
    else if (response.acquisition?.status === "unavailable" || response.acquisition?.status === "error") {
      setPageState("pgn_unavailable");
      if (response.acquisition.status === "error") setError(response.acquisition.reason);
    }
  }
  async function inspect() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id || !tab.url?.startsWith("https://www.chess.com/")) { setActiveTabId(null); setSnapshot(null); setPageState("unsupported"); return; }
      setActiveTabId(tab.id);
      let response = await chrome.tabs.sendMessage(tab.id, { type: "INSPECT_PAGE" }) as ChessComPageSnapshot;
      if (response.safetyState !== "SAFE_COMPLETED_GAME" && (response.hints?.gameId ?? response.completedGame?.gameId)) {
        // Page markup is best-effort; a game that already exists in the public archive is finished.
        const proof = await message<{ ok: boolean; snapshot?: ChessComPageSnapshot }>({ type: "VERIFY_ARCHIVE_COMPLETION", tabId: tab.id, expectedGameId: response.hints?.gameId });
        if (proof.ok && proof.snapshot) response = proof.snapshot;
      }
      setSnapshot(response);
      if (response.safetyState === "LIVE_GAME") setPageState("live");
      else if (response.safetyState === "UNKNOWN") setPageState("unknown");
      else {
        const existing = await message<CompletedResponse>({ type: "GET_COMPLETED_ANALYSIS", tabId: tab.id, expectedGameId: response.completedGame?.gameId });
        applyCompletedResponse(existing);
      }
    }
    catch { setPageState("unknown"); }
  }
  async function startImported(pgnValue: string) {
    try { parsePgn(pgnValue); const response = await message<{ ok: boolean; summary?: ReviewSummary; error?: string }>({ type: "START_ANALYSIS", pgn: pgnValue, safetyState: "SAFE_IMPORTED_PGN" }); if (!response.ok || !response.summary) throw new Error(response.error ?? vi.popup.startFailed); setReopeningExisting(Boolean(response.summary.status === "completed")); setSummary(response.summary); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : vi.popup.startFailed); }
  }
  async function startCompleted() {
    if (!activeTabId || snapshot?.safetyState !== "SAFE_COMPLETED_GAME") { setError(vi.popup.verifyFailed); return; }
    try {
      const response = await message<CompletedResponse>({ type: "START_COMPLETED_ANALYSIS", tabId: activeTabId, expectedGameId: snapshot.completedGame?.gameId });
      if (!response.summary) { applyCompletedResponse(response); if (!response.ok) throw new Error(response.error ?? vi.popup.startFailed); return; }
      setReopeningExisting(response.summary.status === "completed"); setSummary(response.summary); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : vi.popup.startFailed); }
  }
  async function retryCompletedPgn() {
    if (!activeTabId) return;
    setError(""); setPageState("acquiring");
    try { applyCompletedResponse(await message<CompletedResponse>({ type: "RETRY_COMPLETED_PGN", tabId: activeTabId, expectedGameId: snapshot?.completedGame?.gameId })); }
    catch (caught) { setPageState("pgn_unavailable"); setError(caught instanceof Error ? caught.message : vi.popup.retryFailed); }
  }
  async function resetAnalysisContext() {
    if (!summary) return;
    try {
      await exitPopupAnalysis(summary, message);
      setSummary(null); setReopeningExisting(false); setError(""); setPageState("loading");
      await inspect();
    } catch (caught) {
      setSummary({ ...summary, status: "failed", error: caught instanceof Error ? caught.message : vi.popup.closeFailed });
    }
  }
  const openReviewView = (view: "previous" | "settings") => { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?view=${view}`) }); window.close(); };
  const header = <header><Mascot mood={summary ? (summary.status === "completed" ? "cheer" : "think") : "happy"} size={36}/><strong className="brand-title">{vi.brand}</strong><button className="ibtn" aria-label={vi.popup.settingsOpen} title={vi.popup.settings} onClick={() => openReviewView("settings")}><Settings/></button></header>;
  if (summary) return <div className="popup">{header}<PopupSummaryView summary={summary} onCancel={() => void message({ type: "CANCEL_ANALYSIS", analysisId: summary.analysisId }).then(() => setSummary({ ...summary, status: "cancelled" }))} onExit={() => void resetAnalysisContext()} onDeep={(analysisId) => { void message({ type: "OPEN_ANALYSIS", analysisId }); window.close(); }} deepLabel={reopeningExisting ? vi.result.reopen : undefined}/></div>;
  const copy = vi.popup.status[pageState];
  const mood: Record<PageState, MascotMood> = { loading: "think", unsupported: "happy", completed: "cheer", acquiring: "think", pgn_unavailable: "sad", live: "think", unknown: "sad" };
  return <div className="popup">{header}<main>
    <div className={`status status-${pageState}`} role="status"><Mascot mood={mood[pageState]} size={64}/><div><h1>{copy.title}</h1><p>{copy.body}</p></div></div>
    {error && <p className="popup-error" role="alert">{error}</p>}
    {pageState === "completed" && <button className="primary wide" onClick={() => void startCompleted()}>{vi.popup.startJustPlayed}</button>}
    {pageState === "pgn_unavailable" && <button className="secondary wide" onClick={() => void retryCompletedPgn()}>{vi.popup.retry}</button>}
    {pageState === "unknown" && <button className="primary wide" onClick={() => { setError(""); setPageState("loading"); void inspect(); }}>{vi.popup.retry}</button>}
    {pageState === "live" && <><p className="note"><Lock/><span>{vi.popup.liveNote}</span></p><button className="primary wide" disabled>{vi.popup.liveLocked}</button><p className="popup-hint centered">{vi.popup.liveHint}</p></>}
    <LatestGameCard onAnalyze={(latestPgn) => void startImported(latestPgn)}/>
    <ImportPanel label={pageState === "pgn_unavailable" ? vi.popup.pastePgn : vi.popup.importPgn} onAnalyze={(value) => void startImported(value)}/>
  </main><footer><button onClick={() => openReviewView("previous")}><FolderOpen/> {vi.popup.previous}</button><ThemeToggle/></footer></div>;
}
