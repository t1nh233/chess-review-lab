import { ChessComPageAdapter } from "../adapters/chessCom/pageAdapter";
import { isExtensionMessage } from "../background/messages";

const adapter = new ChessComPageAdapter();
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(message) || message.type !== "INSPECT_PAGE") return false;
  sendResponse(adapter.inspect(document, location.href));
  return false;
});
