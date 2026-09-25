import { describe, expect, it } from "vitest";
import { parseHttpUrl, parseInput, urlKey } from "./input";

describe("parseInput", () => {
  it.each([
    ["10.1038/nature12373", { doi: "10.1038/nature12373", url: null }],
    ["https://doi.org/10.1038/nature12373", { doi: "10.1038/nature12373", url: null }],
    ["doi:10.1038/nature12373", { doi: "10.1038/nature12373", url: null }],
    ["https://example.com/blog/post", { doi: null, url: "https://example.com/blog/post" }],
    ["example.com/blog/post", { doi: null, url: "https://example.com/blog/post" }],
  ])("classifies %j", (input, expected) => {
    expect(parseInput(input)).toEqual(expected);
  });

  it.each([["not-a-doi"], [""], ["hello world"], ["ftp://example.com/file"], ["javascript:alert(1)"]])(
    "rejects %j",
    (input) => {
      expect(parseInput(input)).toBeNull();
    }
  );
});

describe("parseHttpUrl / urlKey", () => {
  it("normalizes URLs", () => {
    expect(parseHttpUrl(" https://Example.com/a ")).toBe("https://example.com/a");
    expect(parseHttpUrl("http://localhost:3000/x")).toBe("http://localhost:3000/x");
  });
  it("produces a stable comparison key", () => {
    expect(urlKey("https://Example.com/a/")).toBe(urlKey("https://example.com/a#top"));
    expect(urlKey("http://example.com/a")).toBe("https://example.com/a");
    expect(urlKey("nope")).toBeNull();
  });
});
