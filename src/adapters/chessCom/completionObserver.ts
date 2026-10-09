import { ChessComPageAdapter, type ChessComCompletedGameMetadata } from "./pageAdapter";

export interface CompletionObserverOptions {
  document: Document;
  currentUrl: () => string;
  onCompleted: (metadata: ChessComCompletedGameMetadata) => void;
  delayMs?: number;
}

export function observeGameCompletion(options: CompletionObserverOptions): () => void {
  const adapter = new ChessComPageAdapter();
  let previousState = adapter.inspect(options.document, options.currentUrl()).safetyState;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const inspect = () => {
    scheduled = undefined;
    const snapshot = adapter.inspect(options.document, options.currentUrl());
    if (previousState === "LIVE_GAME" && snapshot.safetyState === "SAFE_COMPLETED_GAME" && snapshot.completedGame) {
      options.onCompleted(snapshot.completedGame);
    }
    previousState = snapshot.safetyState;
  };
  const observer = new MutationObserver(() => {
    if (scheduled === undefined) scheduled = setTimeout(inspect, options.delayMs ?? 350);
  });
  if (options.document.documentElement) observer.observe(options.document.documentElement, { childList: true, subtree: true, attributes: true });
  return () => { observer.disconnect(); if (scheduled !== undefined) clearTimeout(scheduled); };
}
