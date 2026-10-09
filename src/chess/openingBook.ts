/**
 * Chess.com PGNs carry an ECOUrl whose slug ends with the opening line, for example
 * ".../Queens-Pawn-Opening-Horwitz-Defense-2.c4-c5-3.d5-exd5". Everything up to the last move named there is
 * opening theory, so those plies are treated as "book". Without an ECOUrl no book moves are reported.
 */
export function bookPlyCount(ecoUrl?: string): number {
  if (!ecoUrl) return 0;
  const slug = ecoUrl.split("/").filter(Boolean).pop() ?? "";
  const tokens = slug.replace(/O-O-O/g, "OOO").replace(/O-O/g, "OO").split("-");
  let ply = 0;
  let sawMoveNumber = false;
  for (const token of tokens) {
    const numbered = /^(\d+)(\.{1,3})(.+)$/.exec(token);
    if (numbered) {
      sawMoveNumber = true;
      ply = Number(numbered[1]) * 2 - (numbered[2] === "." ? 1 : 0);
    } else if (sawMoveNumber && /^[a-hKQRBNO][a-hxKQRBNO0-9=+#]*$/.test(token)) {
      ply += 1;
    }
  }
  if (sawMoveNumber) return ply;
  // No explicit moves in the slug: the name alone only proves the first move was book-like.
  return 0;
}

/** "…/openings/Caro-Kann-Defense-Hillbilly-Attack-2.c4-d5" -> "Caro Kann Defense Hillbilly Attack". */
export function openingNameFromUrl(ecoUrl?: string): string | undefined {
  if (!ecoUrl) return undefined;
  const slug = ecoUrl.split("/").filter(Boolean).pop() ?? "";
  const name = slug.split("-").filter((token) => !/^\d+\./.test(token) ).join(" ");
  const firstMove = slug.search(/-\d+\./);
  const base = (firstMove >= 0 ? slug.slice(0, firstMove) : slug).replace(/-/g, " ").trim();
  return base || name || undefined;
}
