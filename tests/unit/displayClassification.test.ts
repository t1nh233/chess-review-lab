import { describe, expect, it } from "vitest";
import type { MoveReview, MoveTag, PrimaryClassification } from "../../src/analysis/analysisTypes";
import { DISPLAY_CLASSIFICATION_LABELS, toDisplayClassification } from "../../src/popup/displayClassification";

const move = (primaryClassification: PrimaryClassification, tags: MoveTag[] = []) => ({ primaryClassification, tags }) as Pick<MoveReview, "primaryClassification" | "tags">;

describe("popup display classification", () => {
  it.each([
    ["brilliant", [], "brilliant", "Thiên tài"], ["great", [], "great", "Tuyệt"], ["best", [], "best", "Tốt nhất"],
    ["excellent", [], "best", "Tốt nhất"], ["good", [], "best", "Tốt nhất"], ["inaccuracy", [], "mistake", "Sai lầm"],
    ["mistake", [], "mistake", "Sai lầm"], ["good", ["missed_opportunity"], "miss", "Bỏ lỡ"], ["blunder", [], "blunder", "Nước sai lầm ngớ ngẩn"],
  ] as const)("maps %s to the six-tier presentation", (internal, tags, expected, label) => {
    const display = toDisplayClassification(move(internal, [...tags]));
    expect(display).toBe(expected); expect(DISPLAY_CLASSIFICATION_LABELS[display]).toBe(label);
  });
  it("gives blunder precedence over a missed-opportunity tag", () => expect(toDisplayClassification(move("blunder", ["missed_opportunity"]))).toBe("blunder"));
  it("gives great precedence over other tags", () => expect(toDisplayClassification(move("great", ["missed_opportunity"]))).toBe("great"));
});
