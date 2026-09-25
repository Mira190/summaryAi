import { describe, expect, it, vi } from "vitest";
import { buildCrossrefUrl, fetchCrossrefWork, normalizeWork } from "./crossref";
import { abortError, crossrefWork, jsonResponse, stubFetch } from "../test/fetch";

describe("buildCrossrefUrl", () => {
  it("encodes the DOI and omits mailto when not configured", () => {
    expect(buildCrossrefUrl("10.1000/a/b", "")).toBe("https://api.crossref.org/works/10.1000%2Fa%2Fb");
  });

  it("appends mailto from VITE_CROSSREF_MAILTO", () => {
    vi.stubEnv("VITE_CROSSREF_MAILTO", "me@example.com");
    expect(buildCrossrefUrl("10.1038/nature12373")).toBe(
      "https://api.crossref.org/works/10.1038%2Fnature12373?mailto=me%40example.com"
    );
  });
});

describe("normalizeWork", () => {
  it("maps Crossref fields to app metadata", () => {
    expect(normalizeWork(crossrefWork, "10.1038/nature12373")).toEqual({
      doi: "10.1038/nature12373",
      title: "Nanometre-scale thermometry in a living cell",
      authors: ["G. Kucsko", "P. C. Maurer", "Consortium X"],
      journal: "Nature",
      year: 2013,
      abstract: "Sensitive probing of temperature.",
      url: "https://doi.org/10.1038/nature12373",
    });
  });

  it("falls back through the date fields and tolerates missing data", () => {
    const work = { "published-online": { "date-parts": [[2020]] }, title: [] };
    expect(normalizeWork(work, "10.1234/X")).toEqual({
      doi: "10.1234/x",
      title: null,
      authors: [],
      journal: null,
      year: 2020,
      abstract: null,
      url: "https://doi.org/10.1234/x",
    });
    expect(normalizeWork({ issued: { "date-parts": [[null]] } }, "10.1234/y").year).toBeNull();
  });
});

describe("fetchCrossrefWork", () => {
  it("returns normalized metadata on success", async () => {
    vi.stubEnv("VITE_CROSSREF_MAILTO", "");
    const fetchMock = stubFetch([[() => true, () => jsonResponse({ status: "ok", message: crossrefWork })]]);
    const meta = await fetchCrossrefWork("10.1038/nature12373");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.crossref.org/works/10.1038%2Fnature12373",
      expect.objectContaining({ signal: undefined })
    );
    expect(meta.title).toBe("Nanometre-scale thermometry in a living cell");
    expect(meta.year).toBe(2013);
  });

  it("maps 404 to a not_found error", async () => {
    stubFetch([[() => true, () => jsonResponse("Resource not found.", 404)]]);
    await expect(fetchCrossrefWork("10.1038/missing")).rejects.toMatchObject({
      name: "CrossrefError",
      code: "not_found",
      message: expect.stringMatching(/DOI not found/),
    });
  });

  it("maps other HTTP errors to an http error", async () => {
    stubFetch([[() => true, () => jsonResponse({}, 503)]]);
    await expect(fetchCrossrefWork("10.1038/x")).rejects.toMatchObject({ code: "http", status: 503 });
  });

  it("maps fetch failures to a network error", async () => {
    stubFetch([[() => true, () => Promise.reject(new TypeError("Failed to fetch"))]]);
    await expect(fetchCrossrefWork("10.1038/x")).rejects.toMatchObject({ code: "network" });
  });

  it("rethrows aborts untouched and passes the signal through", async () => {
    const controller = new AbortController();
    const fetchMock = stubFetch([[() => true, () => Promise.reject(abortError())]]);
    await expect(fetchCrossrefWork("10.1038/x", { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
