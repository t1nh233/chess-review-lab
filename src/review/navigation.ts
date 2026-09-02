export type ReviewView = "import" | "review" | "previous" | "settings";

export function initialReviewView(search: string): ReviewView {
  const requested = new URLSearchParams(search).get("view");
  return requested === "previous" || requested === "settings" ? requested : "import";
}
