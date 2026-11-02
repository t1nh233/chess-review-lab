import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as { permissions: string[]; content_scripts: { matches: string[] }[] };

/** Chrome match-pattern semantics for the https/host/path patterns used here (the fragment is never part of a match). */
function matches(pattern: string, url: string): boolean {
  const { origin, pathname, search } = new URL(url);
  const [, scheme, host, path] = /^(https):\/\/([^/]+)(\/.*)$/.exec(pattern)!;
  if (origin !== `${scheme}://${host}`) return false;
  const escaped = path.replace(/[\^$.+?()[\]{}|]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp("^" + escaped + "$");
  return regex.test(pathname + search);
}
const covered = (url: string) => manifest.content_scripts.flatMap((script) => script.matches).some((pattern) => matches(pattern, url));

describe("content script scope", () => {
  it("never runs on the whole site", () => {
    const patterns = manifest.content_scripts.flatMap((script) => script.matches);
    expect(patterns).not.toContain("https://www.chess.com/*");
    expect(patterns.some((pattern) => pattern.includes("<all_urls>") || pattern.startsWith("*"))).toBe(false);
  });

  it.each([
    "https://www.chess.com/game/live/123456789",
    "https://www.chess.com/game/daily/123456789",
    "https://www.chess.com/game/123456789",
    "https://www.chess.com/analysis/game/live/123456789/analysis",
    "https://www.chess.com/play/online",
    "https://www.chess.com/live#g=123456789",
    "https://www.chess.com/games/view/123456789",
  ])("covers game page %s", (url) => expect(covered(url)).toBe(true));

  it.each([
    "https://www.chess.com/home",
    "https://www.chess.com/forum/view/general",
    "https://www.chess.com/puzzles/rated",
    "https://www.chess.com/article/view/some-article",
    "https://www.chess.com/member/someone",
    "https://example.com/game/live/1",
  ])("does not cover %s", (url) => expect(covered(url)).toBe(false));

  it("declares scripting so the popup can inject on demand with activeTab", () => {
    expect(manifest.permissions).toEqual(expect.arrayContaining(["activeTab", "scripting"]));
  });
});
