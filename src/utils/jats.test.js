import { describe, expect, it } from "vitest";
import { stripJats } from "./jats";

describe("stripJats", () => {
  it("removes JATS tags and the leading Abstract heading", () => {
    const input =
      "<jats:title>Abstract</jats:title><jats:p>Quantum <jats:italic>dots</jats:italic> are   small.</jats:p>" +
      "<jats:p>Second &amp; last paragraph with H<jats:sub>2</jats:sub>O.</jats:p>";
    expect(stripJats(input)).toBe("Quantum dots are small.\n\nSecond & last paragraph with H2O.");
  });

  it("keeps section titles other than Abstract as their own paragraph", () => {
    const input = "<jats:sec><jats:title>Background</jats:title><jats:p>Text.</jats:p></jats:sec>";
    expect(stripJats(input)).toBe("Background\n\nText.");
  });

  it("decodes numeric entities and handles plain HTML", () => {
    expect(stripJats("<p>&#955; &#x3bc; &lt;5&gt;</p>")).toBe("λ μ <5>");
  });

  it("returns an empty string for empty or non-string input", () => {
    expect(stripJats("")).toBe("");
    expect(stripJats(null)).toBe("");
    expect(stripJats(undefined)).toBe("");
  });
});
