import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DISPLAY_CLASSIFICATIONS, DISPLAY_CLASSIFICATION_META } from "../../src/presentation/displayClassification";
import { ClassificationIcon, DisplayClassificationBadge } from "../../src/presentation/classificationIcons";
import { MoveBadge } from "../../src/components/MoveBadge";

describe("shared classification presentation", () => {
  it("defines all six Vietnamese labels, original icon glyphs, and semantic colors", () => {
    expect(DISPLAY_CLASSIFICATIONS).toEqual(["brilliant", "great", "best", "mistake", "miss", "blunder"]);
    expect(Object.fromEntries(DISPLAY_CLASSIFICATIONS.map((key) => [key, DISPLAY_CLASSIFICATION_META[key].icon]))).toEqual({
      brilliant: "!!", great: "!", best: "★", mistake: "?", miss: "✕", blunder: "??",
    });
    expect(Object.fromEntries(DISPLAY_CLASSIFICATIONS.map((key) => [key, DISPLAY_CLASSIFICATION_META[key].label]))).toEqual({
      brilliant: "Thiên tài", great: "Tuyệt", best: "Tốt nhất", mistake: "Sai lầm", miss: "Bỏ lỡ", blunder: "Nước sai lầm ngớ ngẩn",
    });
    for (const key of DISPLAY_CLASSIFICATIONS) expect(DISPLAY_CLASSIFICATION_META[key].semanticColor).toBe(`var(--classification-${key})`);
  });

  it("renders every semantic style and an accessible label without relying on color", () => {
    render(<>{DISPLAY_CLASSIFICATIONS.map((classification) => <DisplayClassificationBadge key={classification} classification={classification}/>)}</>);
    for (const classification of DISPLAY_CLASSIFICATIONS) {
      const badge = screen.getByLabelText(DISPLAY_CLASSIFICATION_META[classification].label);
      expect(badge).toHaveClass(`display-classification-${classification}`);
      expect(badge).toHaveTextContent(DISPLAY_CLASSIFICATION_META[classification].icon);
      expect(badge).toHaveTextContent(DISPLAY_CLASSIFICATION_META[classification].label);
    }
  });

  it("supports an independently accessible SVG icon", () => {
    render(<ClassificationIcon classification="great" accessibleLabel="Tuyệt classification"/>);
    expect(screen.getByRole("img", { name: "Tuyệt classification" })).toHaveTextContent("!");
  });

  it("adapts rich Deep Review classifications through the shared metadata", () => {
    const { rerender } = render(<MoveBadge classification="excellent"/>);
    expect(screen.getByLabelText("Tốt nhất")).toHaveTextContent("★");
    rerender(<MoveBadge classification="good" tags={["missed_opportunity"]}/>);
    expect(screen.getByLabelText("Bỏ lỡ")).toHaveTextContent("✕");
  });
});
