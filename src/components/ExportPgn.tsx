import { useState } from "react";
import type { GameReview } from "../analysis/analysisTypes";
import { copyPgn, downloadPgn, exportAnalysisPgn, exportCleanPgn } from "../chess/pgnExport";

export function ExportPgn({ review }: { review: GameReview }) {
  const [open, setOpen] = useState(false); const [feedback, setFeedback] = useState("");
  const copy = async (kind: "clean" | "analysis") => {
    try { await copyPgn(kind === "clean" ? exportCleanPgn(review) : exportAnalysisPgn(review)); setFeedback("Đã sao chép"); }
    catch { setFeedback("Không thể sao chép. Hãy dùng nút Tải xuống."); }
  };
  return <div className="export-pgn"><button onClick={() => setOpen((value) => !value)}>Xuất PGN</button>{open && <div className="export-menu">
    <strong>PGN gốc</strong><button onClick={() => void copy("clean")}>Sao chép</button><button onClick={() => { downloadPgn(review, "clean"); setFeedback("Đã tải xuống"); }}>Tải xuống</button>
    <strong>PGN kèm phân tích</strong><button onClick={() => void copy("analysis")}>Sao chép</button><button onClick={() => { downloadPgn(review, "analysis"); setFeedback("Đã tải xuống"); }}>Tải xuống</button>
    {feedback && <span role="status">{feedback}</span>}
  </div>}</div>;
}
