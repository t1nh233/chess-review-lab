const PGN_PATTERN = /(?:\[(?:Event|Site)\s+"[^"]*"\][\s\S]{0,20000}?)(?:1-0|0-1|1\/2-1\/2)(?=\s|$)/;

export function extractPgn(doc: Document): string | null {
  const candidates = [
    ...Array.from(doc.querySelectorAll<HTMLElement>("[data-pgn], textarea, [data-cy*='pgn'], .share-menu-tab-pgn"))
      .flatMap((node) => [node.dataset.pgn, node instanceof HTMLTextAreaElement ? node.value : node.textContent]),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const decoded = candidate.replace(/&quot;/g, '"').trim();
    if (/\[\w+\s+"/.test(decoded) && /\b(?:1-0|0-1|1\/2-1\/2)\s*$/.test(decoded)) return decoded;
  }
  const scripts = Array.from(doc.querySelectorAll("script[type='application/ld+json'], script[type='application/json']"));
  for (const script of scripts) {
    const match = script.textContent?.match(PGN_PATTERN);
    if (match) return match[0].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return null;
}
