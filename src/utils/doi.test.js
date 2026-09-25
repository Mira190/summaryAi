import { describe, expect, it } from "vitest";
import { isDoi, parseDoi, toDoiUrl } from "./doi";

describe("parseDoi", () => {
  it.each([
    ["10.1038/nature12373", "10.1038/nature12373"],
    ["  10.1038/NATURE12373  ", "10.1038/nature12373"],
    ["doi:10.1038/nature12373", "10.1038/nature12373"],
    ["DOI: 10.1038/nature12373", "10.1038/nature12373"],
    ["https://doi.org/10.1038/nature12373", "10.1038/nature12373"],
    ["http://dx.doi.org/10.1038/nature12373", "10.1038/nature12373"],
    ["https://doi.org/10.1038%2Fnature12373", "10.1038/nature12373"],
  ])("parses %j", (input, expected) => {
    expect(parseDoi(input)).toBe(expected);
  });

  it("extracts a DOI embedded in a publisher URL", () => {
    expect(parseDoi("https://link.springer.com/article/10.1007/s00125-020-05100-9?utm=x#sec1")).toBe(
      "10.1007/s00125-020-05100-9"
    );
    expect(parseDoi("https://onlinelibrary.wiley.com/doi/full/10.1002/anie.201915678")).toBe(
      "10.1002/anie.201915678"
    );
    expect(parseDoi("https://onlinelibrary.wiley.com/doi/10.1002/anie.201915678/abstract")).toBe(
      "10.1002/anie.201915678"
    );
    expect(
      parseDoi("https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0123456&type=x")
    ).toBe("10.1371/journal.pone.0123456");
  });

  it("strips trailing punctuation", () => {
    expect(parseDoi("10.1038/nature12373.")).toBe("10.1038/nature12373");
    expect(parseDoi("(see 10.1038/nature12373),")).toBe("10.1038/nature12373");
    expect(parseDoi("10.1038/nature12373;")).toBe("10.1038/nature12373");
  });

  it("keeps balanced parentheses that belong to the DOI", () => {
    expect(parseDoi("10.1002/(SICI)1097-4636(199706)35:4")).toBe("10.1002/(sici)1097-4636(199706)35:4");
  });

  it.each([["not-a-doi"], [""], ["   "], ["10.12/too-short"], ["https://example.com/article"], [null], [42]])(
    "returns null for %j",
    (input) => {
      expect(parseDoi(input)).toBeNull();
    }
  );
});

describe("isDoi", () => {
  it("is true only when the whole input is a DOI", () => {
    expect(isDoi("10.1038/nature12373")).toBe(true);
    expect(isDoi("doi:10.1038/nature12373")).toBe(true);
    expect(isDoi("https://doi.org/10.1038/nature12373")).toBe(true);
    expect(isDoi("https://link.springer.com/article/10.1007/s00125-020-05100-9")).toBe(false);
    expect(isDoi("not-a-doi")).toBe(false);
  });
});

describe("toDoiUrl", () => {
  it("builds a doi.org link", () => {
    expect(toDoiUrl("10.1038/nature12373")).toBe("https://doi.org/10.1038/nature12373");
  });
  it("escapes characters that would break the URL", () => {
    expect(toDoiUrl("10.1000/a#b?c")).toBe("https://doi.org/10.1000/a%23b%3Fc");
  });
});
