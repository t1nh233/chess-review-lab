import { useState } from "react";
import type { GameReview } from "../analysis/analysisTypes";
import { copyPgn, downloadPgn, exportAnalysisPgn, exportCleanPgn } from "../chess/pgnExport";

export function ExportPgn({ review }: { review: GameReview }) {
  const [open, setOpen] = useState(false); const [feedback, setFeedback] = useState("");
  const copy = async (kind: "clean" | "analysis") => {
    try { await copyPgn(kind === "clean" ? exportCleanPgn(review) : exportAnalysisPgn(review)); setFeedback("Copied"); }
    catch { setFeedback("Clipboard access failed. Use Download instead."); }
  };
  return <div className="export-pgn"><button onClick={() => setOpen((value) => !value)}>Export PGN</button>{open && <div className="export-menu">
    <strong>Clean PGN</strong><button onClick={() => void copy("clean")}>Copy</button><button onClick={() => { downloadPgn(review, "clean"); setFeedback("Downloaded"); }}>Download</button>
    <strong>Analysis PGN</strong><button onClick={() => void copy("analysis")}>Copy</button><button onClick={() => { downloadPgn(review, "analysis"); setFeedback("Downloaded"); }}>Download</button>
    {feedback && <span role="status">{feedback}</span>}
  </div>}</div>;
}
