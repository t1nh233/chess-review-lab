import { describe, expect, it } from "vitest";
import type { MoveReview, MoveTag, PrimaryClassification } from "../../src/analysis/analysisTypes";
import { DISPLAY_CLASSIFICATION_LABELS, toDisplayClassification } from "../../src/popup/displayClassification";

const move = (primaryClassification: PrimaryClassification, tags: MoveTag[] = []) => ({ primaryClassification, tags }) as Pick<MoveReview, "primaryClassification" | "tags">;

describe("display classification (Chess.com Game Review categories)", () => {
  it.each([
    ["brilliant", [], "brilliant", "Thiên tài"], ["great", [], "great", "Tuyệt"], ["best", [], "best", "Tốt nhất"],
    ["excellent", [], "excellent", "Tuyệt vời"], ["good", [], "good", "Tốt"], ["inaccuracy", [], "inaccuracy", "Không chính xác"],
    ["mistake", [], "mistake", "Sai lầm"], ["good", ["missed_opportunity"], "miss", "Bỏ lỡ"], ["blunder", [], "blunder", "Nước sai lầm ngớ ngẩn"],
    ["best", ["book"], "book", "Chủ đề sách"], ["excellent", ["book"], "book", "Chủ đề sách"],
  ] as const)("maps %s %j to %s", (internal, tags, expected, label) => {
    const display = toDisplayClassification(move(internal, [...tags]));
    expect(display).toBe(expected); expect(DISPLAY_CLASSIFICATION_LABELS[display]).toBe(label);
  });
  it("gives blunder precedence over a missed-opportunity tag", () => expect(toDisplayClassification(move("blunder", ["missed_opportunity"]))).toBe("blunder"));
  it("gives great precedence over other tags", () => expect(toDisplayClassification(move("great", ["missed_opportunity"]))).toBe("great"));
  it("never hides a mistake or blunder behind the book label", () => {
    expect(toDisplayClassification(move("blunder", ["book"]))).toBe("blunder");
    expect(toDisplayClassification(move("mistake", ["book"]))).toBe("mistake");
  });
});
