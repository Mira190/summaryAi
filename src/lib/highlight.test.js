import { describe, expect, it } from "vitest";
import { splitWithHighlights } from "./highlight";

describe("splitWithHighlights", () => {
  const text = "The cat sat on the mat. It was a sunny day.";

  it("splits around a matching quote", () => {
    expect(splitWithHighlights(text, ["sat on the mat"])).toEqual([
      { text: "The cat ", highlighted: false },
      { text: "sat on the mat", highlighted: true },
      { text: ". It was a sunny day.", highlighted: false },
    ]);
  });

  it("leaves text unhighlighted when the quote isn't found verbatim", () => {
    expect(splitWithHighlights(text, ["not present here"])).toEqual([
      { text, highlighted: false },
    ]);
  });

  it("returns the whole text unhighlighted when there are no quotes", () => {
    expect(splitWithHighlights(text, [])).toEqual([{ text, highlighted: false }]);
  });

  it("merges overlapping/adjacent quote ranges instead of double-highlighting", () => {
    const result = splitWithHighlights(text, ["The cat sat", "sat on the mat"]);
    expect(result).toEqual([
      { text: "The cat sat on the mat", highlighted: true },
      { text: ". It was a sunny day.", highlighted: false },
    ]);
  });

  it("highlights multiple disjoint quotes in order", () => {
    const result = splitWithHighlights(text, ["sunny day", "The cat"]);
    expect(result).toEqual([
      { text: "The cat", highlighted: true },
      { text: " sat on the mat. It was a ", highlighted: false },
      { text: "sunny day", highlighted: true },
      { text: ".", highlighted: false },
    ]);
  });

  it("handles null/undefined text gracefully", () => {
    expect(splitWithHighlights(null, ["quote"])).toEqual([{ text: "", highlighted: false }]);
  });

  it("ignores falsy quotes in the list", () => {
    expect(splitWithHighlights(text, [null, "", "cat"])).toEqual([
      { text: "The ", highlighted: false },
      { text: "cat", highlighted: true },
      { text: " sat on the mat. It was a sunny day.", highlighted: false },
    ]);
  });
});
