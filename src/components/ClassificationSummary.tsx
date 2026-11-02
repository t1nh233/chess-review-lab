import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ClassificationIcon } from "../presentation/classificationIcons";
import {
  BRIEF_CLASSIFICATIONS,
  countDisplayClassifications,
  DISPLAY_CLASSIFICATIONS,
  DISPLAY_CLASSIFICATION_META,
  type DisplayClassification,
} from "../presentation/displayClassification";

export interface ClassificationSummaryMove {
  color: "white" | "black";
  displayClassification: DisplayClassification;
}

export function ClassificationSummary({ whiteName, blackName, whiteAccuracy, blackAccuracy, moves, defaultMode = "brief" }: {
  whiteName: string;
  blackName: string;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  moves: readonly ClassificationSummaryMove[];
  defaultMode?: "brief" | "full";
}) {
  const [mode, setMode] = useState<"brief" | "full">(defaultMode);
  const counts = countDisplayClassifications(moves);
  const score = (value?: number) => value === undefined ? "—" : value.toFixed(1);
  const hasBrilliant = counts.white.brilliant + counts.black.brilliant > 0;
  const rows = mode === "full" ? DISPLAY_CLASSIFICATIONS : DISPLAY_CLASSIFICATIONS.filter((classification) => BRIEF_CLASSIFICATIONS.includes(classification) || (classification === "brilliant" && hasBrilliant));
  return <div className={`classification-summary classification-summary-${mode}`}>
    <table aria-label="Tóm tắt phân loại nước đi">
      <thead><tr><th scope="col"><span className="sr-only">Loại nước đi</span></th><th scope="col"><span>Trắng</span>{whiteName}</th><th scope="col"><span className="sr-only">Biểu tượng</span></th><th scope="col"><span>Đen</span>{blackName}</th></tr></thead>
      <tbody>
        <tr className="accuracy-row"><th scope="row">Độ chính xác <small>ước tính</small></th><td><span className="accuracy-box accuracy-white">{score(whiteAccuracy)}</span></td><td/><td><span className="accuracy-box accuracy-black">{score(blackAccuracy)}</span></td></tr>
        {rows.map((classification) => {
          const meta = DISPLAY_CLASSIFICATION_META[classification];
          return <tr key={classification} data-classification={classification} className={`count-${classification}`}>
            <th scope="row">{meta.label}</th>
            <td aria-label={`${whiteName}: ${counts.white[classification]} ${meta.label}`}>{counts.white[classification]}</td>
            <td className="icon-cell"><ClassificationIcon classification={classification}/></td>
            <td aria-label={`${blackName}: ${counts.black[classification]} ${meta.label}`}>{counts.black[classification]}</td>
          </tr>;
        })}
      </tbody>
    </table>
    <button className="summary-toggle" aria-expanded={mode === "full"} aria-label={mode === "full" ? "Hiện tóm tắt" : "Hiện chi tiết"} title={mode === "full" ? "Tóm tắt" : "Chi tiết"} onClick={() => setMode(mode === "full" ? "brief" : "full")}>
      {mode === "full" ? <ChevronUp/> : <ChevronDown/>}
    </button>
  </div>;
}
