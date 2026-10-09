import type { ReviewSummary } from "./reviewSummary";

interface PopupActionResponse {
  ok: boolean;
  error?: string;
}

type SendPopupMessage = (message: unknown) => Promise<PopupActionResponse>;

export async function exitPopupAnalysis(
  summary: ReviewSummary,
  sendMessage: SendPopupMessage,
): Promise<void> {
  if (summary.status === "queued" || summary.status === "analyzing") {
    const cancellation = await sendMessage({
      type: "CANCEL_ANALYSIS",
      analysisId: summary.analysisId,
    });
    if (!cancellation.ok) throw new Error(cancellation.error ?? "Could not cancel analysis.");
  }

  const dismissal = await sendMessage({
    type: "DISMISS_ANALYSIS",
    analysisId: summary.analysisId,
  });
  if (!dismissal.ok) throw new Error(dismissal.error ?? "Could not close analysis.");
}
