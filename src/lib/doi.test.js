import { describe, expect, it } from "vitest";
import { extractDoi, classifyInput } from "./doi";

describe("extractDoi", () => {
  it("extracts a DOI from a doi.org URL", () => {
    expect(extractDoi("https://doi.org/10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("extracts a DOI from a dx.doi.org URL", () => {
    expect(extractDoi("http://dx.doi.org/10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("extracts a bare DOI", () => {
    expect(extractDoi("10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("strips a doi: prefix", () => {
    expect(extractDoi("doi:10.1038/nphys1170")).toBe("10.1038/nphys1170");
  });

  it("strips trailing punctuation", () => {
    expect(extractDoi("10.1038/nphys1170.")).toBe("10.1038/nphys1170");
  });

  it("returns null for non-DOI input", () => {
    expect(extractDoi("not a doi at all")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractDoi("")).toBeNull();
  });
});

describe("classifyInput", () => {
  it("classifies a DOI", () => {
    expect(classifyInput("10.1234/abcd.5678")).toEqual({ type: "doi", doi: "10.1234/abcd.5678" });
  });

  it("classifies a plain URL", () => {
    expect(classifyInput("https://example.com/article")).toEqual({
      type: "url",
      url: "https://example.com/article",
    });
  });

  it("classifies blank input as invalid", () => {
    expect(classifyInput("   ")).toEqual({ type: "invalid" });
  });

  it("classifies garbage as invalid", () => {
    expect(classifyInput("just some words")).toEqual({ type: "invalid" });
  });

  it("classifies a non-http URL scheme as invalid", () => {
    expect(classifyInput("ftp://example.com/file")).toEqual({ type: "invalid" });
  });

  it("prefers DOI classification when a doi.org URL is given", () => {
    expect(classifyInput("https://doi.org/10.1038/nphys1170")).toEqual({
      type: "doi",
      doi: "10.1038/nphys1170",
    });
  });
});
