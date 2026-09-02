import type { PrimaryClassification } from "../analysis/analysisTypes";
import { CLASS_LABELS } from "./classificationLabels";
export function MoveBadge({ classification }: { classification: PrimaryClassification }) { return <span className={`badge badge-${classification}`}>{CLASS_LABELS[classification]}</span>; }
