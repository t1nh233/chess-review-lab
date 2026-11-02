import { useEffect, useState } from "react";
import { vi } from "../i18n/vi";
import { History } from "lucide-react";
import { fetchGamesPage, isValidChessComUsername, type LatestGame } from "../adapters/chessCom/latestGame";
import { getChessComUsername, latestGameKey, markGameSeen, saveChessComUsername } from "../storage/chessComProfile";

function when(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Date(timestamp).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function outcome(game: LatestGame): "win" | "loss" | "draw" {
  if (game.result === "1/2-1/2") return "draw";
  const whiteWon = game.result === "1-0";
  return (whiteWon && game.userColor === "white") || (!whiteWon && game.userColor === "black") ? "win" : "loss";
}
const OUTCOME_LABEL = { win: vi.games.win, loss: vi.games.loss, draw: vi.games.draw } as const;
const timeLabel = (game: LatestGame) => game.timeClass ?? game.timeControl ?? "";

export function LatestGameCard({ onAnalyze }: { onAnalyze: (pgn: string) => void }) {
  const [username, setUsername] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [games, setGames] = useState<LatestGame[]>([]);
  const [nextPage, setNextPage] = useState<number | undefined>(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => { void getChessComUsername().then(setUsername); }, []);
  const load = async (name: string, page: number, replace: boolean) => {
    setStatus("loading");
    try {
      const result = await fetchGamesPage(name, page);
      setGames((current) => replace ? result.games : [...current, ...result.games]);
      setNextPage(result.nextPage); setStatus("idle");
    } catch { setStatus("error"); }
  };
  useEffect(() => { if (username) void load(username, 0, true); }, [username]);

  const save = () => { if (!isValidChessComUsername(draft)) return; void saveChessComUsername(draft).then(() => { setGames([]); setUsername(draft.trim()); }); };
  if (username === null) return null;
  if (!username) return <section className="latest-game">
    <h2><History/> {vi.games.introTitle}</h2>
    <p>{vi.games.intro}</p>
    <div className="latest-game-form"><input value={draft} placeholder={vi.games.usernamePlaceholder} aria-label={vi.games.usernameLabel} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); }}/><button className="primary" disabled={!isValidChessComUsername(draft)} onClick={save}>{vi.games.save}</button></div>
  </section>;
  const analyze = (game: LatestGame) => { void markGameSeen(latestGameKey(games[0] ?? game)); void chrome.action.setBadgeText({ text: "" }); onAnalyze(game.pgn); };
  return <section className="latest-game">
    <h2><History/> {vi.games.title} <button className="link" onClick={() => { void saveChessComUsername("").then(() => { setUsername(""); setGames([]); setNextPage(0); setDraft(username); }); }}>{username} · {vi.games.change}</button></h2>
    {status === "error" && <p role="alert">{vi.games.error} <button className="link" onClick={() => void load(username, nextPage ?? 0, games.length === 0)}>{vi.games.retry}</button></p>}
    {status === "loading" && games.length === 0 && <p>{vi.games.loading}</p>}
    {status === "idle" && games.length === 0 && <p>{vi.games.empty}</p>}
    <ul className="game-list">{games.map((game) => {
      const result = outcome(game);
      return <li key={`${game.url}-${game.endTime}`}>
        <span className={`outcome outcome-${result}`}>{OUTCOME_LABEL[result]}</span>
        <span className="game-main"><span className="game-name"><b>{game.opponent}</b>{game.opponentRating ? <em>{game.opponentRating}</em> : null}</span><small>{timeLabel(game)} · {game.userColor === "white" ? vi.games.white : vi.games.black} · {when(game.endTime)}</small></span>
        <button className="secondary" onClick={() => analyze(game)}>{vi.games.analyze}</button>
      </li>;
    })}</ul>
    {nextPage !== undefined && games.length > 0 && <button className="secondary wide" disabled={status === "loading"} onClick={() => void load(username, nextPage, false)}>{status === "loading" ? vi.games.loadingMore : vi.games.loadMore}</button>}
  </section>;
}
