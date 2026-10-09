import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swords, X, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, FlipHorizontal2, FolderOpen, Gauge, RotateCcw, Settings as SettingsIcon, Square, Upload } from "lucide-react";
import { analyzeGame, ENGINE_PRESETS } from "../analysis/analyzeGame";
import { PositionAnalysisCache } from "../analysis/positionAnalysisCache";
import type { GameReview } from "../analysis/analysisTypes";
import { gameFingerprint, parsePgn } from "../chess/pgn";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { ChessBoard } from "../components/ChessBoard";
import { EvalBar } from "../components/EvalBar";
import { EvaluationChart } from "../components/EvaluationChart";
import { GameSummary } from "../components/GameSummary";
import { MoveList } from "../components/MoveList";
import { ThemeToggle } from "../components/ThemeToggle";
import { openingNameFromUrl } from "../chess/openingBook";
import { LatestGameCard } from "../popup/LatestGameCard";
import { PlayerBar } from "../components/PlayerBar";
import { toDisplayClassification } from "../popup/displayClassification";
import { SettingsPanel } from "../components/SettingsPanel";
import { ANALYSIS_MODEL_VERSION, CLASSIFIER_VERSION, ENGINE_VERSION, EXPECTED_POINTS_MODEL_VERSION } from "../config/versions";
import { StockfishClient } from "../engine/stockfishClient";
import type { GameSafetyState } from "../safety/liveGameGuard";
import { deleteCachedReview, findCachedReview, getCachedReview, listCachedReviews, saveCachedReview, type CachedReview } from "../storage/analysisCache";
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from "../storage/settings";
import { initialReviewView, type ReviewView } from "./navigation";
import { shouldLoadReviewToken } from "./reviewSession";
import { debugLog } from "../utils/logger";
import { getReviewSelection, keyboardSelectedPly } from "./selection";

interface Payload { pgn: string; safetyState: GameSafetyState }

async function message<T>(value: unknown): Promise<T> { return chrome.runtime.sendMessage(value) as Promise<T>; }

export function ReviewApp() {
  const [view, setView] = useState<ReviewView>(() => initialReviewView(location.search));
  const [review, setReview] = useState<GameReview | null>(null);
  const [selectedPly, setSelectedPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [engineDepth, setEngineDepth] = useState(0);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [cached, setCached] = useState<CachedReview[]>([]);
  const activeAbort = useRef<AbortController | null>(null);
  const loadedToken = useRef<string | null>(null);
  const loadedAnalysisId = useRef<string | null>(null);
  const runSequence = useRef(0);
  const lazyEngine = useRef<StockfishClient | null>(null);
  const lazyAbort = useRef<AbortController | null>(null);
  const reviewSafety = useRef<GameSafetyState>("SAFE_IMPORTED_PGN");
  const positionCache = useRef(new PositionAnalysisCache());
  const selectedPlyRef = useRef(0);

  const refreshCached = useCallback(async () => setCached(await listCachedReviews()), []);
  useEffect(() => {
    let active = true;
    void getSettings().then((value) => { if (active) setSettings(value); }).finally(() => { if (active) setSettingsLoaded(true); });
    void refreshCached();
    return () => { active = false; };
  }, [refreshCached]);
  useEffect(() => () => { activeAbort.current?.abort(); lazyAbort.current?.abort(); lazyEngine.current?.dispose(); }, []);

  const runPayload = useCallback(async (payload: Payload, force = false) => {
    const runId = ++runSequence.current;
    activeAbort.current?.abort();
    lazyAbort.current?.abort(); lazyEngine.current?.dispose(); lazyEngine.current = null; reviewSafety.current = payload.safetyState;
    activeAbort.current = null;
    setError(""); setReview(null); setSelectedPly(0); setView("review"); setProgress([0, 1]); setEngineDepth(0);
    let controller: AbortController | null = null;
    try {
      const game = parsePgn(payload.pgn); const fingerprint = gameFingerprint(game);
      const classifierMode = settings.compatibilityClassifier ? "compatibility" : "strict";
      const existing = !force && settings.cachePreviousReviews ? await findCachedReview({
        fingerprint, preset: settings.analysisQuality, engineVersion: ENGINE_VERSION,
        analysisModelVersion: ANALYSIS_MODEL_VERSION, expectedPointsModelVersion: EXPECTED_POINTS_MODEL_VERSION,
        classifierVersion: CLASSIFIER_VERSION, classifierMode,
      }) : undefined;
      if (runSequence.current !== runId) return;
      if (existing) { setReview(existing.results); setSelectedPly(0); setProgress(null); return; }
      controller = new AbortController(); activeAbort.current = controller;
      const engine = new StockfishClient();
      try {
        const result = await analyzeGame(game, engine, {
          safetyState: payload.safetyState,
          preset: settings.analysisQuality,
          compatibilityClassifier: settings.compatibilityClassifier,
          positionCache: positionCache.current,
          getPriorityPosition: () => selectedPlyRef.current,
          signal: controller.signal,
          onProgress: (done, total) => { if (runSequence.current === runId) setProgress([done, total]); },
          onEngineProgress: (value) => { if (runSequence.current === runId) setEngineDepth(value.currentDepth); },
          onPartialReview: (partial) => { if (runSequence.current === runId) setReview(partial); },
        });
        if (runSequence.current !== runId) return;
        setReview(result); setSelectedPly(0);
        if (settings.cachePreviousReviews) await saveCachedReview({
          analysisId: crypto.randomUUID(), createdAt: Date.now(), gameFingerprint: fingerprint, pgn: payload.pgn,
          engineVersion: result.engineVersion, enginePreset: result.enginePreset, analysisModelVersion: result.analysisModelVersion,
          expectedPointsModelVersion: result.expectedPointsModelVersion, classifierVersion: result.classifierVersion,
          classifierMode: result.classifierMode, results: result,
        }, settings.maxCachedReviews);
        await refreshCached();
      } finally { engine.dispose(); }
    } catch (caught) {
      if (runSequence.current === runId) setError(caught instanceof DOMException && caught.name === "AbortError" ? "Analysis was cancelled." : caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      if (runSequence.current === runId) setProgress(null);
      if (activeAbort.current === controller) activeAbort.current = null;
    }
  }, [refreshCached, settings]);

  const loadToken = useCallback(async (token: string) => {
    const response = await message<{ ok: boolean; payload?: Payload; error?: string }>({ type: "GET_REVIEW_PAYLOAD", token });
    if (!response.ok || !response.payload) { setError(response.error ?? "Review session expired."); return; }
    await runPayload(response.payload);
  }, [runPayload]);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("token");
    if (!shouldLoadReviewToken(settingsLoaded, token, loadedToken.current)) return;
    loadedToken.current = token;
    void loadToken(token!);
  }, [loadToken, settingsLoaded]);
  useEffect(() => {
    const analysisId = new URLSearchParams(location.search).get("analysisId");
    if (!analysisId || loadedAnalysisId.current === analysisId) return;
    loadedAnalysisId.current = analysisId;
    void getCachedReview(analysisId).then((cachedReview) => {
      if (!cachedReview) { setError("This completed analysis is not available in local storage."); return; }
      setReview(cachedReview.results); setSelectedPly(0); setView("review");
    });
  }, []);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!review || ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement).tagName)) return;
      const next = keyboardSelectedPly(selectedPly, event.key, review.moves.length);
      if (next !== undefined) setSelectedPly(next);
    };
    addEventListener("keydown", handle); return () => removeEventListener("keydown", handle);
  }, [review, selectedPly]);

  useEffect(() => {
    if (!review || !selectedPly || progress) return;
    const index = selectedPly - 1;
    if ((review.positions[index]?.lines.length ?? 0) >= 3 || review.moves[index]?.continuationsStatus === "loading") return;
    const runId = runSequence.current; const controller = new AbortController(); lazyAbort.current?.abort(); lazyAbort.current = controller;
    setReview((current) => current ? { ...current, moves: current.moves.map((move, moveIndex) => moveIndex === index ? { ...move, continuationsStatus: "loading" } : move) } : current);
    void (async () => {
      const queuedAt = performance.now();
      try {
        const preset = ENGINE_PRESETS[settings.analysisQuality];
        const request = { fen: review.positions[index].fen, engineVersion: ENGINE_VERSION, engineMode: settings.analysisQuality, depth: preset.depth, multiPv: 3 };
        let result = positionCache.current.get(request);
        const cacheState = result ? "hit" : "miss";
        const searchStarted = performance.now();
        if (!result) {
          if (!lazyEngine.current) { lazyEngine.current = new StockfishClient(); await lazyEngine.current.initialize(reviewSafety.current); }
          result = await lazyEngine.current.analyze({ fen: request.fen, depth: request.depth, multiPv: 3, positionIndex: index }, controller.signal);
          positionCache.current.set(request, result);
        }
        debugLog("analysis_search_timing", { phase: "lazyContinuation", positionIndex: index, targetDepth: request.depth, actualDepth: result.depth, multiPv: 3, queueWaitMs: searchStarted - queuedAt, engineSearchDurationMs: performance.now() - searchStarted, nodes: result.lines[0]?.nodes, nps: result.lines[0]?.nps, cache: cacheState });
        if (controller.signal.aborted || runSequence.current !== runId) return;
        setReview((current) => current ? { ...current,
          positions: current.positions.map((position, positionIndex) => positionIndex === index ? { ...position, bestMove: result!.bestMove, lines: result!.lines, analysisDepth: result!.depth } : position),
          moves: current.moves.map((move, moveIndex) => moveIndex === index ? { ...move, bestMove: result!.bestMove, principalVariation: result!.lines[0]?.moves ?? [], continuationLines: result!.lines, continuationsStatus: "ready" } : move),
        } : current);
      } catch (caught) {
        // Always clear the loading flag so a skipped or failed position can be requested again later.
        setReview((current) => current ? { ...current, moves: current.moves.map((move, moveIndex) => moveIndex === index && move.continuationsStatus === "loading" ? { ...move, continuationsStatus: undefined } : move) } : current);
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Continuation analysis failed.");
      }
    })();
  }, [progress, review, selectedPly, settings.analysisQuality]);

  const importPgn = async (pgn: string) => {
    try { parsePgn(pgn); const response = await message<{ ok: boolean; token?: string; error?: string }>({ type: "START_REVIEW", pgn, safetyState: "SAFE_IMPORTED_PGN" }); if (!response.ok || !response.token) throw new Error(response.error); history.replaceState(null, "", `review.html?token=${encodeURIComponent(response.token)}`); await loadToken(response.token); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "This PGN could not be parsed."); }
  };
  // Drops the current review (cancelling any running analysis) so another game can be picked without the popup.
  const closeReview = () => {
    runSequence.current += 1;
    activeAbort.current?.abort(); activeAbort.current = null;
    lazyAbort.current?.abort(); lazyEngine.current?.dispose(); lazyEngine.current = null;
    setReview(null); setSelectedPly(0); setProgress(null); setError("");
    history.replaceState(null, "", "review.html?view=games"); loadedToken.current = null; loadedAnalysisId.current = null;
    setView("games");
  };
  const updateSettings = (next: Settings) => { setSettings(next); void saveSettings(next); };
  const selection = review ? getReviewSelection(review, selectedPly) : undefined;
  const currentFen = selection?.currentFen ?? "8/8/8/8/8/8/8/8 w - - 0 1";
  const selectedMove = selection?.selectedMove;
  selectedPlyRef.current = selectedPly;
  const effectiveOrientation = settings.boardOrientation === "auto" ? orientation : settings.boardOrientation;

  return <div className="app-shell"><header className="topbar"><button className="brand" onClick={() => setView(review ? "review" : "import")}><span className="brand-mark">CR</span><span>Chess Review Lab</span></button><nav><button className={view === "import" ? "active" : ""} onClick={() => setView("import")}><Upload/> Import</button><button className={view === "games" ? "active" : ""} onClick={() => setView("games")}><Swords/> Ván đấu</button><button className={view === "previous" ? "active" : ""} onClick={() => { setView("previous"); void refreshCached(); }}><FolderOpen/> Previous</button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><SettingsIcon/> Settings</button><ThemeToggle/></nav></header>
    {error && <div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
    {view === "import" && <ImportView onImport={importPgn}/>} 
    {view === "settings" && <main className="narrow"><SettingsPanel settings={settings} onChange={updateSettings}/><aside className="about-note"><h2>About the model</h2><p>Move thresholds follow publicly documented Expected Points categories. Expected Points, Estimated Accuracy, Great, Brilliant, and Miss detection are independently implemented approximations.</p><strong>Fair play</strong><p>Analysis is unavailable for live or unverified online games.</p></aside></main>}
    {view === "games" && <main className="narrow"><LatestGameCard onAnalyze={(pgn) => void importPgn(pgn)}/></main>}
    {view === "previous" && <main className="narrow"><section className="previous-list"><h1>Previous reviews</h1>{cached.length === 0 && <p>No cached reviews yet.</p>}{cached.map((item) => <article key={item.analysisId}><div><strong>{item.results.game.headers.White ?? "White"} vs {item.results.game.headers.Black ?? "Black"}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.enginePreset}</span></div><div><button onClick={() => { setReview(item.results); setView("review"); setSelectedPly(0); }}>Open</button><button className="icon-button danger" title="Delete review" aria-label="Delete review" onClick={() => void deleteCachedReview(item.analysisId).then(refreshCached)}>×</button></div></article>)}</section></main>}
    {view === "review" && review && (() => {
      const top = effectiveOrientation === "white" ? "black" : "white"; const bottom = effectiveOrientation;
      const bar = (color: "white" | "black") => <PlayerBar color={color} name={color === "white" ? review.game.headers.White ?? "White" : review.game.headers.Black ?? "Black"} rating={color === "white" ? review.game.whiteRating : review.game.blackRating} accuracy={color === "white" ? review.whiteAccuracy : review.blackAccuracy}/>;
      return <main className="review-layout"><section className="board-column">{bar(top)}<div className="board-stage"><EvalBar evaluation={selectedMove?.evalAfter ?? review.positions[0].evaluation.white} orientation={effectiveOrientation}/><ChessBoard fen={currentFen} orientation={effectiveOrientation} lastMove={selectedMove?.uci} badge={selectedMove ? toDisplayClassification(selectedMove) : undefined} bestMove={settings.showBestMoveArrow && selectedMove && selectedMove.bestMove !== selectedMove.uci ? selectedMove.bestMove : undefined}/></div>{bar(bottom)}<div className="board-controls"><button className="icon-button" title="Flip board" aria-label="Flip board" onClick={() => setOrientation((value) => value === "white" ? "black" : "white")}><FlipHorizontal2/></button><div className="navigator"><button className="icon-button" title="Start" aria-label="First move" disabled={selectedPly === 0} onClick={() => setSelectedPly(0)}><ChevronsLeft/></button><button className="icon-button" title="Previous move" aria-label="Previous move" disabled={selectedPly === 0} onClick={() => setSelectedPly((value) => Math.max(0, value - 1))}><ArrowLeft/></button><span>{selectedPly} / {review.moves.length}</span><button className="icon-button" title="Next move" aria-label="Next move" disabled={selectedPly === review.moves.length} onClick={() => setSelectedPly((value) => Math.min(review.moves.length, value + 1))}><ArrowRight/></button><button className="icon-button" title="End" aria-label="Last move" disabled={selectedPly === review.moves.length} onClick={() => setSelectedPly(review.moves.length)}><ChevronsRight/></button></div><button className="icon-button" title="Re-run analysis" aria-label="Re-run analysis" onClick={() => void runPayload({ pgn: review.game.pgn, safetyState: "SAFE_IMPORTED_PGN" }, true)}><RotateCcw/></button></div></section><section className="review-column"><div className="game-title"><div><span>{review.game.headers.Event ?? "Imported game"}</span><h1>{review.game.headers.White ?? "White"} <small>vs</small> {review.game.headers.Black ?? "Black"}</h1></div><span className="result">{review.game.result ?? "Completed"}</span></div><div className="review-actions"><button onClick={() => setView("games")}><Swords/> Chọn ván khác</button><button className="close-review" onClick={closeReview}><X/> Đóng phân tích</button></div><EvaluationChart moves={review.moves} selectedPly={selectedPly} onSelect={setSelectedPly}/><AnalysisPanel move={selectedMove}/><GameSummary review={review} onSelect={setSelectedPly}><MoveList moves={review.moves} selectedPly={selectedPly} onSelect={setSelectedPly} openingName={openingNameFromUrl(review.game.headers.ECOUrl)}/></GameSummary></section></main>;
    })()}
    {view === "review" && progress && <div className="progress-overlay" role="status"><div><Gauge/><h2>Analyzing game</h2><p>Position {progress[0]} / {progress[1]}</p><p>depth={engineDepth || "initializing"} | Stockfish 18 NNUE</p><progress value={progress[0]} max={progress[1]}/><button onClick={() => activeAbort.current?.abort()}><Square/> Cancel analysis</button></div></div>}
  </div>;
}

function ImportView({ onImport }: { onImport: (pgn: string) => Promise<void> }) {
  const [pgn, setPgn] = useState(""); const [fileName, setFileName] = useState("");
  const canSubmit = useMemo(() => pgn.trim().length > 0, [pgn]);
  return <main className="import-view"><section><span className="eyebrow">Offline review</span><h1>Import a completed game</h1><p>Paste PGN or choose a `.pgn` file. Analysis runs locally and starts only after you submit.</p><label className="file-picker"><Upload/><span>{fileName || "Choose PGN file"}</span><input type="file" accept=".pgn,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); void file.text().then(setPgn); } }}/></label><label className="pgn-input"><span>PGN</span><textarea value={pgn} onChange={(event) => setPgn(event.target.value)} placeholder={'[Event "Casual Game"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 ... 1-0'}/></label><button className="primary" disabled={!canSubmit} onClick={() => void onImport(pgn)}>Analyze imported PGN</button></section><aside><h2>Fair-play boundary</h2><p>Chess Review Lab analyzes completed or explicitly imported games only. It refuses analysis when an online game's status is live or uncertain.</p><dl><div><dt>Engine</dt><dd>Stockfish 18 · local WASM</dd></div><div><dt>Default quality</dt><dd>Balanced · depth 18</dd></div><div><dt>Data</dt><dd>Stored only in this browser</dd></div></dl></aside></main>;
}
