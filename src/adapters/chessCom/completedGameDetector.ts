import type { GameSafetyEvidence } from "../../safety/liveGameGuard";

const ACTIVE_LIVE_SELECTORS = [".live-game-buttons", "[aria-label*='Offer Draw']", "[aria-label*='Resign']"];
const CLOCK_SELECTORS = ["[data-cy='game-clock']", ".clock-component"];
const COMPLETE_SELECTORS = [
  "[data-cy='game-over-modal']", ".game-over-modal-content", ".game-result-component", "[data-test-element='game-result']",
  "[data-cy='game-result']", "[data-game-over='true']", "[data-state='game-over']",
];

const COMPLETION_TEXT = /game over|checkmate|checkmated|won by resignation|resigned|draw by|draw agreed|stalemate|won on time|time(?:d)? out|timeout|abandoned/i;

export function collectSafetyEvidence(doc: Document, url: string): GameSafetyEvidence {
  const liveIndicators = ACTIVE_LIVE_SELECTORS.filter((selector) => doc.querySelector(selector));
  const completedIndicators = COMPLETE_SELECTORS.filter((selector) => doc.querySelector(selector));
  const text = (doc.body?.innerText ?? "").slice(0, 250_000);
  const hasCompletionText = COMPLETION_TEXT.test(text);
  if (hasCompletionText) completedIndicators.push("result-text");
  if (/game in progress|your turn|opponent's turn/i.test(text)) liveIndicators.push("live-text");
  const result = /(?:\[Result\s+"(1-0|0-1|1\/2-1\/2)"\])|(?:\b(1-0|0-1|1\/2-1\/2)\b)/.exec(text);
  const hasPositiveCompletion = Boolean(result && completedIndicators.length);
  if (!hasPositiveCompletion) liveIndicators.push(...CLOCK_SELECTORS.filter((selector) => doc.querySelector(selector)));
  return { source: "chess.com", url, explicitResult: result?.[1] ?? result?.[2], liveIndicators, completedIndicators };
}
