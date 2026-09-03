import { ClassificationIcon } from "../presentation/classificationIcons";
import {
  countDisplayClassifications,
  DISPLAY_CLASSIFICATIONS,
  DISPLAY_CLASSIFICATION_META,
  type DisplayClassification,
} from "../presentation/displayClassification";

export interface ClassificationSummaryMove {
  color: "white" | "black";
  displayClassification: DisplayClassification;
}

export function ClassificationSummary({ whiteName, blackName, whiteAccuracy, blackAccuracy, moves }: {
  whiteName: string;
  blackName: string;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  moves: readonly ClassificationSummaryMove[];
}) {
  const counts = countDisplayClassifications(moves);
  const score = (value?: number) => value === undefined ? "—" : value.toFixed(1);
  return <table className="classification-summary" aria-label="Classification summary">
    <thead><tr><th scope="col"><span className="sr-only">Category</span></th><th scope="col"><span>White</span>{whiteName}</th><th scope="col"><span>Black</span>{blackName}</th></tr></thead>
    <tbody>
      <tr className="accuracy-row"><th scope="row">Estimated Accuracy</th><td>{score(whiteAccuracy)}</td><td>{score(blackAccuracy)}</td></tr>
      {DISPLAY_CLASSIFICATIONS.map((classification) => {
        const meta = DISPLAY_CLASSIFICATION_META[classification];
        return <tr key={classification} data-classification={classification}>
          <th scope="row"><ClassificationIcon classification={classification}/><span>{meta.label}</span></th>
          <td aria-label={`${whiteName}: ${counts.white[classification]} ${meta.label}`}>{counts.white[classification]}</td>
          <td aria-label={`${blackName}: ${counts.black[classification]} ${meta.label}`}>{counts.black[classification]}</td>
        </tr>;
      })}
    </tbody>
  </table>;
}
