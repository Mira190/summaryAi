import { describe, expect, it } from "vitest";
import { parseHttpUrl, parseInput, urlKey } from "./input";

describe("parseInput", () => {
  it.each([
    ["10.1038/nature12373", { doi: "10.1038/nature12373", url: null }],
    ["https://doi.org/10.1038/nature12373", { doi: "10.1038/nature12373", url: null }],
    ["doi:10.1038/nature12373", { doi: "10.1038/nature12373", url: null }],
    ["https://example.com/blog/post", { doi: null, url: "https://example.com/blog/post" }],
    ["example.com/blog/post", { doi: null, url: "https://example.com/blog/post" }],
    ["http://dx.doi.org/10.1038/nature12373", { doi: "10.1038/nature12373", url: null }],
    [
      "https://link.springer.com/article/10.1007/s00125-020-05100-9/fulltext.html",
      {
        doi: "10.1007/s00125-020-05100-9",
        url: "https://link.springer.com/article/10.1007/s00125-020-05100-9/fulltext.html",
      },
    ],
    [
      "https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1.full.pdf",
      {
        doi: "10.1101/2020.01.01.123456v1",
        url: "https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1.full.pdf",
      },
    ],
  ])("classifies %j", (input, expected) => {
    expect(parseInput(input)).toEqual(expected);
  });

  it.each([
    ["not-a-doi"],
    [""],
    ["hello world"],
    ["ftp://example.com/file"],
    ["javascript:alert(1)"],
    ["10.123/abc"],
    ["1.2.3.4/path"],
    ["127.1"],
    ["foo.b/x"],
  ])(
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
    expect(parseHttpUrl("example.com:8080/x")).toBe("https://example.com:8080/x");
  });

  it("only accepts IP hosts when a scheme is given explicitly", () => {
    expect(parseHttpUrl("10.123/abc")).toBeNull();
    expect(parseHttpUrl("192.168.0.1/x")).toBeNull();
    expect(parseHttpUrl("http://192.168.0.1/x")).toBe("http://192.168.0.1/x");
  });
  it("produces a stable comparison key", () => {
    expect(urlKey("https://Example.com/a/")).toBe(urlKey("https://example.com/a#top"));
    expect(urlKey("http://example.com/a")).toBe("https://example.com/a");
    expect(urlKey("nope")).toBeNull();
  });
});
