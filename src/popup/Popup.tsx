import { useEffect, useMemo, useState } from "react";
import { FileUp, FolderOpen, Search, Settings, Square } from "lucide-react";
import type { ChessComPageSnapshot } from "../adapters/chessCom/pageAdapter";
import { parsePgn } from "../chess/pgn";
import type { GameSafetyState } from "../safety/liveGameGuard";
import { ClassificationSummary } from "../components/ClassificationSummary";
import { DisplayClassificationBadge } from "../presentation/classificationIcons";
import { groupSummaryMoves, type ReviewSummary } from "./reviewSummary";

type PageState = "loading" | "unsupported" | "completed" | "live" | "unknown" | "extraction_failed";
async function message<T>(value: unknown): Promise<T> { return chrome.runtime.sendMessage(value) as Promise<T>; }

export function PopupSummaryView({ summary, onCancel, onDeep }: { summary: ReviewSummary; onCancel: () => void; onDeep: (analysisId: string) => void }) {
  const rows = useMemo(() => groupSummaryMoves(summary.moves), [summary.moves]);
  const phaseLabel = summary.phase === "refinement" || summary.phase === "multiPvExpansion" ? "Refining critical moves" : summary.phase === "finalizing" ? "Finalizing" : "Quick analysis";
  const progressValue = summary.phaseCompleted ?? summary.currentPly;
  const progressMax = Math.max(1, summary.phaseTotal ?? summary.totalPlies);
  if (summary.status === "queued" || summary.status === "analyzing") return <main className="popup-summary" aria-label="Analysis progress">
    <h1>{summary.whiteName} <small>vs</small> {summary.blackName}</h1>
    <strong>{phaseLabel}{summary.phase !== "finalizing" ? ` ${progressValue} / ${progressMax}` : ""}</strong>
    {summary.phase === "quick" || !summary.phase ? <small>Analyzing {summary.currentPly} / {summary.totalPlies}</small> : null}
    <span>depth={summary.currentDepth ?? "initializing"} | Stockfish 18 Lite</span>
    <progress value={progressValue} max={progressMax}/>
    <button className="secondary wide" onClick={onCancel}><Square/> Cancel</button>
  </main>;
  if (summary.status === "completed") return <main className="popup-summary completed-summary">
    <h1>{summary.whiteName} <small>vs</small> {summary.blackName}</h1>
    <ClassificationSummary whiteName={summary.whiteName} blackName={summary.blackName} whiteAccuracy={summary.whiteAccuracy} blackAccuracy={summary.blackAccuracy} moves={summary.moves}/>
    <div className="popup-moves" role="table" aria-label="Move classifications"><div className="popup-move-header" role="row"><b>#</b><b>White</b><b>Black</b></div>{rows.map((row) => <div className="popup-move-row" role="row" key={row.moveNumber}><b>{row.moveNumber}</b>{([row.white, row.black]).map((move, index) => <span role="cell" key={move?.ply ?? `${row.moveNumber}-${index}`}>{move ? <><strong>{move.san}</strong><DisplayClassificationBadge classification={move.displayClassification} compact/></> : "—"}</span>)}</div>)}</div>
    <button className="primary wide" onClick={() => onDeep(summary.analysisId)}>Xem phân tích sâu</button>
  </main>;
  return <main className="popup-summary"><h1>{summary.status === "cancelled" ? "Analysis cancelled" : "Analysis failed"}</h1><p>{summary.error ?? "You can start the review again."}</p></main>;
}

export function Popup() {
  const [pageState, setPageState] = useState<PageState>("loading"); const [snapshot, setSnapshot] = useState<ChessComPageSnapshot | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null); const [error, setError] = useState(""); const [showImport, setShowImport] = useState(false); const [pgn, setPgn] = useState(""); const [fileName, setFileName] = useState("");
  const summaryId = summary?.analysisId; const summaryStatus = summary?.status;
  useEffect(() => { void (async () => { const active = await message<{ summary?: ReviewSummary }>({ type: "GET_ACTIVE_ANALYSIS" }); if (active.summary) setSummary(active.summary); else await inspect(); })(); }, []);
  useEffect(() => {
    if (!summaryId || !summaryStatus || !["queued", "analyzing"].includes(summaryStatus)) return;
    const timer = setInterval(() => { void message<{ ok: boolean; summary?: ReviewSummary }>({ type: "GET_ANALYSIS_STATE", analysisId: summaryId }).then((response) => { if (response.summary) setSummary(response.summary); }); }, 300);
    return () => clearInterval(timer);
  }, [summaryId, summaryStatus]);
  async function inspect() {
    try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab.id || !tab.url?.startsWith("https://www.chess.com/")) { setPageState("unsupported"); return; } const response = await chrome.tabs.sendMessage(tab.id, { type: "INSPECT_PAGE" }) as ChessComPageSnapshot; setSnapshot(response); if (response.safetyState === "LIVE_GAME") setPageState("live"); else if (response.safetyState === "UNKNOWN") setPageState("unknown"); else if (!response.pgn) setPageState("extraction_failed"); else setPageState("completed"); }
    catch { setPageState("unknown"); }
  }
  async function start(pgnValue: string, safetyState: GameSafetyState) {
    try { parsePgn(pgnValue); const response = await message<{ ok: boolean; summary?: ReviewSummary; error?: string }>({ type: "START_ANALYSIS", pgn: pgnValue, safetyState }); if (!response.ok || !response.summary) throw new Error(response.error ?? "Unable to start analysis."); setSummary(response.summary); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start analysis."); }
  }
  const openReviewView = (view: "previous" | "settings") => { void chrome.tabs.create({ url: chrome.runtime.getURL(`review.html?view=${view}`) }); window.close(); };
  if (summary) return <div className="popup"><header><span className="brand-mark">CR</span><div><strong>Chess Review Lab</strong><span>Local post-game analysis</span></div></header><PopupSummaryView summary={summary} onCancel={() => void message({ type: "CANCEL_ANALYSIS", analysisId: summary.analysisId }).then(() => setSummary({ ...summary, status: "cancelled" }))} onDeep={(analysisId) => { void message({ type: "OPEN_ANALYSIS", analysisId }); window.close(); }}/></div>;
  const copy: Record<PageState, { title: string; body: string }> = { loading:{title:"Checking this page",body:"Confirming that analysis is safe."},unsupported:{title:"No completed game found",body:"Open a completed Chess.com game, or import a PGN."},completed:{title:"Completed game ready",body:"The game result and PGN were confirmed."},live:{title:"Analysis disabled",body:"Analysis is unavailable while a game is in progress."},unknown:{title:"Game status unconfirmed",body:"Unable to confirm this game has ended. Import the PGN after the game."},extraction_failed:{title:"Import needed",body:"Could not read this completed game automatically. Paste the PGN instead."} };
  return <div className="popup"><header><span className="brand-mark">CR</span><div><strong>Chess Review Lab</strong><span>Local post-game analysis</span></div></header><main><div className={`status status-${pageState}`}><Search/><div><h1>{copy[pageState].title}</h1><p>{copy[pageState].body}</p></div></div>{error && <p className="popup-error" role="alert">{error}</p>}{pageState === "completed" && <button className="primary wide" onClick={() => snapshot?.pgn && void start(snapshot.pgn, "SAFE_COMPLETED_GAME")}>Analyze completed game</button>}<button className="secondary wide" onClick={() => setShowImport((value) => !value)}><FileUp/> Import PGN</button>{showImport && <section className="popup-import"><label>PGN<textarea value={pgn} onChange={(event) => setPgn(event.target.value)}/></label><label className="file-picker">{fileName || "Choose .pgn"}<input type="file" accept=".pgn,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); void file.text().then(setPgn); } }}/></label><button className="primary wide" disabled={!pgn.trim()} onClick={() => void start(pgn, "SAFE_IMPORTED_PGN")}>Analyze imported PGN</button></section>}</main><footer><button onClick={() => openReviewView("previous")}><FolderOpen/> Previous reviews</button><button aria-label="Settings" title="Settings" onClick={() => openReviewView("settings")}><Settings/></button></footer></div>;
}
