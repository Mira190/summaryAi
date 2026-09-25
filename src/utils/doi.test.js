import { describe, expect, it } from "vitest";
import { parseDoi, toDoiUrl } from "./doi";

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

  it("strips publisher view suffixes after the DOI", () => {
    expect(
      parseDoi("https://link.springer.com/article/10.1007/s00125-020-05100-9/fulltext.html")
    ).toBe("10.1007/s00125-020-05100-9");
    expect(parseDoi("https://www.biorxiv.org/content/10.1101/2020.01.01.123456.full.pdf")).toBe(
      "10.1101/2020.01.01.123456"
    );
    expect(parseDoi("https://www.biorxiv.org/content/10.1101/2020.01.01.123456.full")).toBe(
      "10.1101/2020.01.01.123456"
    );
    expect(parseDoi("https://example.org/articles/10.1234/abcd.pdf")).toBe("10.1234/abcd");
    expect(parseDoi("https://example.org/doi/pdf/10.1234/abcd/pdf")).toBe("10.1234/abcd");
  });

  it("strips trailing punctuation", () => {
    expect(parseDoi("10.1038/nature12373.")).toBe("10.1038/nature12373");
    expect(parseDoi("(see 10.1038/nature12373),")).toBe("10.1038/nature12373");
    expect(parseDoi("10.1038/nature12373;")).toBe("10.1038/nature12373");
  });

  it("strips a trailing slash", () => {
    expect(parseDoi("10.1038/nature12373/")).toBe("10.1038/nature12373");
    expect(parseDoi("https://doi.org/10.1038/nature12373/")).toBe("10.1038/nature12373");
    expect(parseDoi("https://onlinelibrary.wiley.com/doi/10.1002/anie.201915678/abstract/")).toBe(
      "10.1002/anie.201915678"
    );
  });

  it("keeps full SICI DOIs, including balanced parentheses and angle brackets", () => {
    const sici = "10.1002/(SICI)1097-4636(199706)35:4<499::AID-JBM10>3.0.CO;2-C";
    expect(parseDoi(sici)).toBe(sici.toLowerCase());
    expect(parseDoi(`doi:${sici}.`)).toBe(sici.toLowerCase());
    expect(parseDoi(`https://doi.org/${encodeURIComponent(sici)}`)).toBe(sici.toLowerCase());
  });

  it.each([["not-a-doi"], [""], ["   "], ["10.12/too-short"], ["https://example.com/article"], [null], [42]])(
    "returns null for %j",
    (input) => {
      expect(parseDoi(input)).toBeNull();
    }
  );
});

describe("toDoiUrl", () => {
  it("builds a doi.org link", () => {
    expect(toDoiUrl("10.1038/nature12373")).toBe("https://doi.org/10.1038/nature12373");
  });
  it("escapes characters that would break the URL", () => {
    expect(toDoiUrl("10.1000/a#b?c")).toBe("https://doi.org/10.1000/a%23b%3Fc");
  });
  it("percent-encodes angle brackets in SICI DOIs", () => {
    expect(toDoiUrl("10.1002/(sici)1097-4636(199706)35:4<499::aid-jbm10>3.0.co;2-c")).toBe(
      "https://doi.org/10.1002/(sici)1097-4636(199706)35:4%3C499::aid-jbm10%3E3.0.co;2-c"
    );
  });
});
