import type { MoveTag, PrimaryClassification } from "../analysis/analysisTypes";
import { DisplayClassificationBadge } from "../presentation/classificationIcons";
import { toDisplayClassification } from "../popup/displayClassification";

export function MoveBadge({ classification, tags = [], compact = false }: {
  classification: PrimaryClassification;
  tags?: MoveTag[];
  compact?: boolean;
}) {
  return <DisplayClassificationBadge classification={toDisplayClassification({ primaryClassification: classification, tags })} compact={compact}/>;
}
