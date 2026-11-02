import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DISPLAY_CLASSIFICATIONS, DISPLAY_CLASSIFICATION_META } from "../../src/presentation/displayClassification";
import { ClassificationIcon, DisplayClassificationBadge } from "../../src/presentation/classificationIcons";
import { MoveBadge } from "../../src/components/MoveBadge";

describe("shared classification presentation", () => {
  it("defines all ten Vietnamese labels, glyphs, and semantic colors", () => {
    expect(DISPLAY_CLASSIFICATIONS).toEqual(["brilliant", "great", "book", "best", "excellent", "good", "inaccuracy", "mistake", "miss", "blunder"]);
    expect(Object.fromEntries(DISPLAY_CLASSIFICATIONS.map((key) => [key, DISPLAY_CLASSIFICATION_META[key].label]))).toEqual({
      brilliant: "Thiên tài", great: "Tuyệt", book: "Khai cuộc", best: "Tốt nhất", excellent: "Xuất sắc", good: "Tốt",
      inaccuracy: "Thiếu chính xác", mistake: "Sai lầm", miss: "Bỏ lỡ", blunder: "Sai nghiêm trọng",
    });
    for (const key of DISPLAY_CLASSIFICATIONS) expect(DISPLAY_CLASSIFICATION_META[key].semanticColor).toBe(`var(--classification-${key})`);
  });

  it("renders every semantic style and an accessible label without relying on color", () => {
    render(<>{DISPLAY_CLASSIFICATIONS.map((classification) => <DisplayClassificationBadge key={classification} classification={classification}/>)}</>);
    const silhouettes = new Set<string>();
    for (const classification of DISPLAY_CLASSIFICATIONS) {
      const badge = screen.getByLabelText(DISPLAY_CLASSIFICATION_META[classification].label);
      expect(badge).toHaveClass(`display-classification-${classification}`);
      expect(badge).toHaveTextContent(DISPLAY_CLASSIFICATION_META[classification].label);
      // Each category draws its own silhouette (first shape of the icon), so colour is never the only cue.
      const shape = badge.querySelector("svg g > :first-child");
      expect(shape).not.toBeNull();
      silhouettes.add(`${shape!.tagName}:${shape!.getAttribute("d") ?? shape!.getAttribute("r") ?? shape!.getAttribute("rx")}`);
    }
    expect(silhouettes.size).toBe(10);
  });

  it("supports an independently accessible SVG icon", () => {
    render(<ClassificationIcon classification="great" accessibleLabel="Tuyệt classification"/>);
    expect(screen.getByRole("img", { name: "Tuyệt classification" })).toHaveClass("classification-icon-great");
  });

  it("adapts rich Deep Review classifications through the shared metadata", () => {
    const { rerender } = render(<MoveBadge classification="excellent"/>);
    expect(screen.getByLabelText("Xuất sắc")).toHaveClass("display-classification-excellent");
    rerender(<MoveBadge classification="good" tags={["missed_opportunity"]}/>);
    expect(screen.getByLabelText("Bỏ lỡ")).toHaveClass("display-classification-miss");
  });
});
