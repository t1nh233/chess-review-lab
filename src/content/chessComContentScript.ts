import { ChessComPageAdapter } from "../adapters/chessCom/pageAdapter";
import { observeGameCompletion } from "../adapters/chessCom/completionObserver";
import { isExtensionMessage } from "../background/messages";

const GUARD = "__chessReviewLabContent";
const scope = globalThis as unknown as Record<string, unknown>;
// The script is declared statically for game pages and injected on demand from the popup elsewhere; never run twice.
if (!scope[GUARD]) {
scope[GUARD] = true;
const adapter = new ChessComPageAdapter();
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(message) || message.type !== "INSPECT_PAGE") return false;
  sendResponse(adapter.inspect(document, location.href));
  return false;
});

observeGameCompletion({
  document,
  currentUrl: () => location.href,
  onCompleted: (metadata) => { void chrome.runtime.sendMessage({ type: "GAME_COMPLETED_AVAILABLE", metadata }); },
});
}
