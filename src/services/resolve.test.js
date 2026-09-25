import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSummary } from "./resolve";
import { parseInput } from "../utils/input";
import {
  abortError,
  crossrefWork,
  isCrossref,
  isRapidApi,
  jsonResponse,
  stubFetch,
} from "../test/fetch";

const DOI = "10.1038/nature12373";

describe("resolveSummary", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "test-key");
    vi.stubEnv("VITE_CROSSREF_MAILTO", "");
  });

  it("DOI: combines Crossref metadata with a summary of https://doi.org/<doi>", async () => {
    const fetchMock = stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, () => jsonResponse({ summary: "Full-text summary." })],
    ]);
    const result = await resolveSummary({ doi: DOI, input: DOI });
    expect(result).toMatchObject({
      id: `doi:${DOI}`,
      doi: DOI,
      title: "Nanometre-scale thermometry in a living cell",
      journal: "Nature",
      year: 2013,
      summary: "Full-text summary.",
      source: "summary",
    });
    expect(fetchMock.mock.calls[1][0]).toContain(encodeURIComponent(`https://doi.org/${DOI}`));
  });

  it("DOI: falls back to the Crossref abstract when summarizing fails", async () => {
    stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, () => jsonResponse({ error: "Paywalled" }, 400)],
    ]);
    const result = await resolveSummary({ doi: DOI });
    expect(result.source).toBe("abstract");
    expect(result.summary).toBe("Sensitive probing of temperature.");
    expect(result.notice).toBe(
      "The full text could not be extracted; showing the publisher's abstract."
    );
  });

  it.each([
    [429, "The summarizer's quota is used up; showing the publisher's abstract."],
    [403, "The summarizer is not configured, so this is the publisher's abstract."],
  ])("DOI: uses a short user-facing notice for HTTP %i", async (status, notice) => {
    stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, () => jsonResponse({}, status)],
    ]);
    await expect(resolveSummary({ doi: DOI })).resolves.toMatchObject({ source: "abstract", notice });
  });

  it("DOI: uses a short notice when the summarizer is unreachable", async () => {
    stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, () => Promise.reject(new TypeError("Failed to fetch"))],
    ]);
    await expect(resolveSummary({ doi: DOI })).resolves.toMatchObject({
      notice: "The summarizer could not be reached; showing the publisher's abstract.",
    });
  });

  it("DOI: falls back to the abstract when the API key is missing", async () => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "");
    const fetchMock = stubFetch([[isCrossref, () => jsonResponse({ message: crossrefWork })]]);
    const result = await resolveSummary({ doi: DOI });
    expect(result.source).toBe("abstract");
    expect(result.notice).toBe("The summarizer is not configured, so this is the publisher's abstract.");
    expect(result.notice).not.toMatch(/VITE_|\.env/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("DOI: errors with partial metadata when there is neither summary nor abstract", async () => {
    stubFetch([
      [isCrossref, () => jsonResponse({ message: { ...crossrefWork, abstract: undefined } })],
      [isRapidApi, () => jsonResponse({}, 429)],
    ]);
    const err = await resolveSummary({ doi: DOI }).catch((e) => e);
    expect(err).toMatchObject({ name: "ResolveError", code: "rate_limited" });
    expect(err.message).toMatch(/no abstract/);
    expect(err.partial).toMatchObject({ title: "Nanometre-scale thermometry in a living cell" });
  });

  it("DOI: reports an unknown DOI without calling the summarizer", async () => {
    const fetchMock = stubFetch([[isCrossref, () => jsonResponse("Resource not found.", 404)]]);
    await expect(resolveSummary({ doi: "10.1038/missing" })).rejects.toMatchObject({
      code: "doi_not_found",
      message: expect.stringMatching(/DOI not found/),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("DOI from a publisher URL: summarizes the URL itself when Crossref does not know the DOI", async () => {
    const url = "https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1.full.pdf";
    const parsed = parseInput(url);
    expect(parsed).toEqual({ doi: "10.1101/2020.01.01.123456v1", url });

    const fetchMock = stubFetch([
      [isCrossref, () => jsonResponse("Resource not found.", 404)],
      [isRapidApi, () => jsonResponse({ summary: "Preprint summary." })],
    ]);
    const result = await resolveSummary({ ...parsed, input: url });
    expect(result).toMatchObject({
      id: `url:${url}`,
      doi: null,
      url,
      summary: "Preprint summary.",
      source: "summary",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain(encodeURIComponent(url));
  });

  it("DOI from a doi.org link: a Crossref 404 is still reported as DOI not found", async () => {
    const parsed = parseInput("https://doi.org/10.1038/missing");
    expect(parsed.url).toBeNull();
    const fetchMock = stubFetch([[isCrossref, () => jsonResponse("Resource not found.", 404)]]);
    await expect(resolveSummary(parsed)).rejects.toMatchObject({ code: "doi_not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("DOI: still summarizes when Crossref is unreachable", async () => {
    stubFetch([
      [isCrossref, () => Promise.reject(new TypeError("Failed to fetch"))],
      [isRapidApi, () => jsonResponse({ summary: "Summary." })],
    ]);
    const result = await resolveSummary({ doi: DOI });
    expect(result).toMatchObject({ doi: DOI, title: null, summary: "Summary.", source: "summary" });
  });

  it("URL: summarizes the page directly", async () => {
    const fetchMock = stubFetch([[isRapidApi, () => jsonResponse({ summary: "Blog summary." })]]);
    const url = "https://example.com/post";
    const result = await resolveSummary({ url, input: url });
    expect(result).toMatchObject({
      id: "url:https://example.com/post",
      doi: null,
      url,
      summary: "Blog summary.",
      source: "summary",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("URL: surfaces summarizer errors", async () => {
    stubFetch([[isRapidApi, () => jsonResponse({}, 429)]]);
    await expect(resolveSummary({ url: "https://example.com/post" })).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  it("propagates aborts", async () => {
    stubFetch([[isCrossref, () => Promise.reject(abortError())]]);
    await expect(resolveSummary({ doi: DOI })).rejects.toMatchObject({ name: "AbortError" });
  });
});
