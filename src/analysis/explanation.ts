import type { MoveReview, PrimaryClassification } from "./analysisTypes";

const BASE: Record<PrimaryClassification, string> = {
  brilliant: "This strong move invests material while retaining tactical compensation.",
  great: "This was the only analyzed candidate that preserved substantially more expected score.",
  best: "This matches the engine's preferred move or a near-equivalent alternative.",
  excellent: "This move keeps nearly all of the position's expected score.",
  good: "This is a sound move with a small concession.",
  inaccuracy: "This move gives up a noticeable amount of expected score.",
  mistake: "This move gives up a significant part of the position's expected score.",
  blunder: "This move loses a large amount of expected score.",
};
export function explainMove(primary: PrimaryClassification, tags: MoveReview["tags"]): string {
  const suffix = tags.includes("missed_opportunity") ? " A strong opportunity created by the previous move was not used." : tags.includes("only_move") ? " Alternatives were meaningfully worse." : "";
  return BASE[primary] + suffix;
}
