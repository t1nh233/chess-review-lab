import { useEffect, useState } from "react";
import { FileUp, FolderOpen, Search, Settings, Square } from "lucide-react";
import type { ChessComPageSnapshot } from "../adapters/chessCom/pageAdapter";
import { parsePgn } from "../chess/pgn";
import { ClassificationSummary } from "../components/ClassificationSummary";
import { type ReviewSummary } from "./reviewSummary";
import { exitPopupAnalysis } from "./popupSession";
import { ThemeToggle } from "../components/ThemeToggle";
import { LatestGameCard } from "./LatestGameCard";
import type { PgnAcquisitionResult } from "../adapters/chessCom/pgnAcquisition";

type PageState = "loading" | "unsupported" | "completed" | "acquiring" | "pgn_unavailable" | "live" | "unknown";
type CompletedResponse = { ok: boolean; summary?: ReviewSummary; cached?: boolean; attached?: boolean; acquisition?: PgnAcquisitionResult; error?: string };
async function message<T>(value: unknown): Promise<T> { return chrome.runtime.sendMessage(value) as Promise<T>; }

export function PopupSummaryView({ summary, onCancel, onExit, onDeep, deepLabel = "Xem phân tích sâu" }: { summary: ReviewSummary; onCancel: () => void; onExit: () => void; onDeep: (analysisId: string) => void; deepLabel?: string }) {
  const phaseLabel = summary.phase === "refinement" || summary.phase === "multiPvExpansion" ? "Refining critical moves" : summary.phase === "finalizing" ? "Finalizing" : "Quick analysis";
  const progressValue = summary.phaseCompleted ?? summary.currentPly;
  const progressMax = Math.max(1, summary.phaseTotal ?? summary.totalPlies);
  if (summary.status === "queued" || summary.status === "analyzing") return <main className="popup-summary" aria-label="Analysis progress">
    <h1>{summary.whiteName} <small>vs</small> {summary.blackName}</h1>
    <strong>{phaseLabel}{summary.phase !== "finalizing" ? ` ${progressValue} / ${progressMax}` : ""}</strong>
    {summary.phase === "quick" || !summary.phase ? <small>Analyzing {summary.currentPly} / {summary.totalPlies}</small> : null}
    <span>depth={summary.currentDepth ?? "initializing"} | Stockfish 18 NNUE</span>
    <progress value={progressValue} max={progressMax}/>
    <div className="popup-actions">
      <button className="secondary" onClick={onCancel}><Square/> Hủy</button>
      <button className="exit-action" onClick={onExit}>Dừng và thoát</button>
    </div>
  </main>;
  if (summary.status === "completed") return <main className="popup-summary completed-summary">
    <h1>{summary.whiteName} <small>vs</small> {summary.blackName}</h1>
    <ClassificationSummary whiteName={summary.whiteName} blackName={summary.blackName} whiteAccuracy={summary.whiteAccuracy} blackAccuracy={summary.blackAccuracy} moves={summary.moves}/>
    <p className="popup-hint">Danh sách nước đi, lời bình và thời gian từng nước nằm ở trang phân tích chi tiết.</p>
    <div className="popup-actions popup-actions-completed">
      <button className="primary" onClick={() => onDeep(summary.analysisId)}>{deepLabel}</button>
      <button className="secondary" onClick={onExit}>Phân tích ván mới</button>
    </div>
  </main>;
  return <main className="popup-summary"><h1>{summary.status === "cancelled" ? "Analysis cancelled" : "Analysis failed"}</h1><p>{summary.error ?? "You can start the review again."}</p><button className="secondary wide" onClick={onExit}>Phân tích ván mới</button></main>;
}

export function Popup() {
  const [pageState, setPageState] = useState<PageState>("loading"); const [snapshot, setSnapshot] = useState<ChessComPageSnapshot | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [reopeningExisting, setReopeningExisting] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null); const [error, setError] = useState(""); const [showImport, setShowImport] = useState(false); const [pgn, setPgn] = useState(""); const [fileName, setFileName] = useState("");
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
    try { parsePgn(pgnValue); const response = await message<{ ok: boolean; summary?: ReviewSummary; error?: string }>({ type: "START_ANALYSIS", pgn: pgnValue, safetyState: "SAFE_IMPORTED_PGN" }); if (!response.ok || !response.summary) throw new Error(response.error ?? "Unable to start analysis."); setReopeningExisting(Boolean(response.summary.status === "completed")); setSummary(response.summary); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start analysis."); }
  }
  async function startCompleted() {
    if (!activeTabId || snapshot?.safetyState !== "SAFE_COMPLETED_GAME") { setError("Unable to verify that the game has ended."); return; }
    try {
      const response = await message<CompletedResponse>({ type: "START_COMPLETED_ANALYSIS", tabId: activeTabId, expectedGameId: snapshot.completedGame?.gameId });
      if (!response.summary) { applyCompletedResponse(response); if (!response.ok) throw new Error(response.error ?? "Unable to start analysis."); return; }
      setReopeningExisting(response.summary.status === "completed"); setSummary(response.summary); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start analysis."); }
  }
  async function retryCompletedPgn() {
    if (!activeTabId) return;
    setError(""); setPageState("acquiring");
    try { applyCompletedResponse(await message<CompletedResponse>({ type: "RETRY_COMPLETED_PGN", tabId: activeTabId, expectedGameId: snapshot?.completedGame?.gameId })); }
    catch (caught) { setPageState("pgn_unavailable"); setError(caught instanceof Error ? caught.message : "Không thể lấy PGN tự động."); }
  }
  async function resetAnalysisContext() {
    if (!summary) return;
    try {
      await exitPopupAnalysis(summary, message);
      setSummary(null); setReopeningExisting(false); setError(""); setPgn(""); setFileName(""); setShowImport(false); setPageState("loading");
      await inspect();
    } catch (caught) {
      setSummary({ ...summary, status: "failed", error: caught instanceof Error ? caught.message : "Could not close analysis." });
    }
  }
  const openReviewView = (view: "previous" | "settings") => { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?view=${view}`) }); window.close(); };
  if (summary) return <div className="popup"><header><span className="brand-mark">CR</span><div><strong>Chess Review Lab</strong><span>Local post-game analysis</span></div></header><PopupSummaryView summary={summary} onCancel={() => void message({ type: "CANCEL_ANALYSIS", analysisId: summary.analysisId }).then(() => setSummary({ ...summary, status: "cancelled" }))} onExit={() => void resetAnalysisContext()} onDeep={(analysisId) => { void message({ type: "OPEN_ANALYSIS", analysisId }); window.close(); }} deepLabel={reopeningExisting ? "Xem lại phân tích" : undefined}/></div>;
  const copy: Record<PageState, { title: string; body: string }> = { loading:{title:"Checking this page",body:"Confirming that analysis is safe."},unsupported:{title:"No completed game found",body:"Open a completed Chess.com game, or import a PGN."},completed:{title:"Ván đấu vừa kết thúc",body:"PGN của đúng ván đấu đã sẵn sàng."},acquiring:{title:"Ván đấu vừa kết thúc",body:"Đang lấy PGN của ván đấu..."},pgn_unavailable:{title:"Ván đấu đã kết thúc",body:"Không thể lấy PGN tự động."},live:{title:"Ván đấu đang diễn ra",body:"Analysis is unavailable while a game is in progress."},unknown:{title:"Game status unconfirmed",body:"Unable to confirm this game has ended. If it just finished, wait a few seconds and reopen this popup (reload the Chess.com tab if the extension was just installed), or import the PGN."} };
  return <div className="popup"><header><span className="brand-mark">CR</span><div><strong>Chess Review Lab</strong><span>Local post-game analysis</span></div></header><main><div className={`status status-${pageState}`}><Search/><div><h1>{copy[pageState].title}</h1><p>{copy[pageState].body}</p></div></div>{error && <p className="popup-error" role="alert">{error}</p>}<LatestGameCard onAnalyze={(latestPgn) => void startImported(latestPgn)}/>{pageState === "completed" && <button className="primary wide" onClick={() => void startCompleted()}>Phân tích ván vừa chơi</button>}{pageState === "pgn_unavailable" && <button className="secondary wide" onClick={() => void retryCompletedPgn()}>Thử lại</button>}<button className="secondary wide" onClick={() => setShowImport((value) => !value)}><FileUp/> {pageState === "pgn_unavailable" ? "Dán PGN" : "Import PGN"}</button>{showImport && <section className="popup-import"><label>PGN<textarea value={pgn} onChange={(event) => setPgn(event.target.value)}/></label><label className="file-picker">{fileName || "Choose .pgn"}<input type="file" accept=".pgn,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); void file.text().then(setPgn); } }}/></label><button className="primary wide" disabled={!pgn.trim()} onClick={() => void startImported(pgn)}>Analyze imported PGN</button></section>}</main><footer><button onClick={() => openReviewView("previous")}><FolderOpen/> Previous reviews</button><ThemeToggle/><button aria-label="Settings" title="Settings" onClick={() => openReviewView("settings")}><Settings/></button></footer></div>;
}
