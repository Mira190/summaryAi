import { describe, expect, it } from "vitest";
import { reconstructAbstract } from "./openalex";

describe("reconstructAbstract", () => {
  it("reconstructs plain text from a word-position inverted index", () => {
    expect(reconstructAbstract({ Hello: [0], world: [1], ".": [2] })).toBe("Hello world .");
  });

  it("handles repeated words at multiple positions", () => {
    expect(reconstructAbstract({ the: [0, 3], cat: [1], and: [2], dog: [4] })).toBe(
      "the cat and the dog"
    );
  });

  it("returns null for a null index", () => {
    expect(reconstructAbstract(null)).toBeNull();
  });

  it("returns null for an empty index", () => {
    expect(reconstructAbstract({})).toBeNull();
  });
});
