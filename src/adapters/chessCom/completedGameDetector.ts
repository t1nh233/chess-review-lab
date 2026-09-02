import type { GameSafetyEvidence } from "../../safety/liveGameGuard";

const LIVE_SELECTORS = [
  "[data-cy='game-clock']", ".clock-component", ".live-game-buttons", "[aria-label*='Offer Draw']", "[aria-label*='Resign']",
];
const COMPLETE_SELECTORS = [
  "[data-cy='game-over-modal']", ".game-over-modal-content", ".game-result-component", "[data-test-element='game-result']",
];

export function collectSafetyEvidence(doc: Document, url: string): GameSafetyEvidence {
  const liveIndicators = LIVE_SELECTORS.filter((selector) => doc.querySelector(selector));
  const completedIndicators = COMPLETE_SELECTORS.filter((selector) => doc.querySelector(selector));
  const text = (doc.body?.innerText ?? "").slice(0, 250_000);
  if (/game over|checkmate|won by resignation|draw by|won on time/i.test(text)) completedIndicators.push("result-text");
  if (/game in progress|your turn|opponent's turn/i.test(text)) liveIndicators.push("live-text");
  const result = /(?:\[Result\s+"(1-0|0-1|1\/2-1\/2)"\])|(?:\b(1-0|0-1|1\/2-1\/2)\b)/.exec(text);
  return { source: "chess.com", url, explicitResult: result?.[1] ?? result?.[2], liveIndicators, completedIndicators };
}
