import { beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackNotice, resolveSummary } from "./resolve";
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
    [403, "The summarizer rejected the API key; showing the publisher's abstract."],
    [401, "The summarizer rejected the API key; showing the publisher's abstract."],
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
      status: 404,
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

  it("DOI from a publisher URL: 404 plus an unconfigured summarizer keeps the actionable code", async () => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "");
    const url = "https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1.full.pdf";
    const fetchMock = stubFetch([[isCrossref, () => jsonResponse("Resource not found.", 404)]]);
    const err = await resolveSummary({ ...parseInput(url), input: url }).catch((e) => e);
    expect(err).toMatchObject({
      name: "ResolveError",
      code: "missing_key",
      message:
        "DOI not found: no Crossref record for 10.1101/2020.01.01.123456v1. " +
        "The page itself could not be summarized either: " +
        "The summarizer is not configured: no RapidAPI key is set.",
    });
    expect(err.cause).toMatchObject({ code: "missing_key" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [() => jsonResponse({}, 429), "rate_limited", 429],
    [() => jsonResponse({}, 403), "key_rejected", 403],
    [() => Promise.reject(new TypeError("Failed to fetch")), "network", undefined],
    [() => jsonResponse({ error: "Cannot extract" }, 400), "doi_not_found", 404],
    [() => jsonResponse({}, 502), "doi_not_found", 404],
  ])("DOI from a publisher URL: 404 plus a failing URL (%#) reports %s", async (respond, code, status) => {
    const url = "https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1.full.pdf";
    stubFetch([
      [isCrossref, () => jsonResponse("Resource not found.", 404)],
      [isRapidApi, respond],
    ]);
    const err = await resolveSummary({ ...parseInput(url), input: url }).catch((e) => e);
    expect(err).toMatchObject({ name: "ResolveError", code });
    expect(err.status).toBe(status);
    expect(err.message).toMatch(/^DOI not found: no Crossref record for 10\.1101\/2020\.01\.01\.123456v1\. /);
  });

  it("DOI from a publisher URL: tries the pasted URL when the doi.org link cannot be summarized", async () => {
    const url = "https://link.springer.com/article/10.1038/nature12373";
    const fetchMock = stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [
        (u) => isRapidApi(u) && u.includes(encodeURIComponent("https://doi.org/")),
        () => jsonResponse({ error: "Cannot extract" }, 400),
      ],
      [
        (u) => isRapidApi(u) && u.includes(encodeURIComponent(url)),
        () => jsonResponse({ summary: "Publisher page summary." }),
      ],
    ]);
    const parsed = parseInput(url);
    expect(parsed).toEqual({ doi: DOI, url });

    const result = await resolveSummary({ ...parsed, input: url });
    expect(result).toMatchObject({
      id: `doi:${DOI}`,
      doi: DOI,
      title: "Nanometre-scale thermometry in a living cell",
      journal: "Nature",
      summary: "Publisher page summary.",
      source: "summary",
      notice: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  const PUBLISHER_URL = "https://link.springer.com/article/10.1038/nature12373";

  /** Crossref OK; the summarizer answers the doi.org attempt, then the publisher URL. */
  function stubTwoAttempts({ abstract = true, first, second }) {
    const summarizer = vi.fn();
    summarizer.mockImplementationOnce(first).mockImplementationOnce(second);
    stubFetch([
      [
        isCrossref,
        () => jsonResponse({ message: abstract ? crossrefWork : { ...crossrefWork, abstract: undefined } }),
      ],
      [isRapidApi, summarizer],
    ]);
    return summarizer;
  }

  const paywall = () => jsonResponse({ error: "Paywall" }, 400);

  it("DOI from a publisher URL: a service error on the retry wins for the notice (network)", async () => {
    const summarizer = stubTwoAttempts({
      first: paywall,
      second: () => Promise.reject(new TypeError("offline")),
    });
    const result = await resolveSummary({ ...parseInput(PUBLISHER_URL), input: PUBLISHER_URL });
    expect(summarizer).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      source: "abstract",
      notice: "The summarizer could not be reached; showing the publisher's abstract.",
    });
  });

  it("DOI from a publisher URL: a service error on the retry wins for the notice (429)", async () => {
    stubTwoAttempts({ first: paywall, second: () => jsonResponse({}, 429) });
    const result = await resolveSummary({ ...parseInput(PUBLISHER_URL), input: PUBLISHER_URL });
    expect(result).toMatchObject({
      source: "abstract",
      notice: "The summarizer's quota is used up; showing the publisher's abstract.",
    });
  });

  it("DOI from a publisher URL: page errors on both attempts report the first, mentioning the second", async () => {
    stubTwoAttempts({
      abstract: false,
      first: paywall,
      second: () => jsonResponse({ error: "Not an article" }, 422),
    });
    const err = await resolveSummary({ ...parseInput(PUBLISHER_URL), input: PUBLISHER_URL }).catch(
      (e) => e
    );
    expect(err).toMatchObject({ name: "ResolveError", code: "extract_failed", status: 400 });
    expect(err.message).toBe(
      "The article could not be extracted: Paywall " +
        "The publisher page could not be summarized either: The article could not be extracted: Not an article " +
        "Crossref has no abstract for this paper either."
    );
    expect(err.cause).toMatchObject({ code: "extract_failed", status: 400 });
    expect(err.partial).toMatchObject({ doi: DOI });
  });

  it("DOI from a publisher URL: without an abstract, a service error on the retry sets the code", async () => {
    stubTwoAttempts({ abstract: false, first: paywall, second: () => jsonResponse({}, 429) });
    const err = await resolveSummary({ ...parseInput(PUBLISHER_URL), input: PUBLISHER_URL }).catch(
      (e) => e
    );
    expect(err).toMatchObject({ name: "ResolveError", code: "rate_limited", status: 429 });
    expect(err.message).toMatch(/^The summarizer's request quota is used up/);
    expect(err.message).toMatch(/The DOI link could not be summarized either: .*Paywall/);
    expect(err.cause).toMatchObject({ code: "rate_limited" });
  });

  it("DOI from a publisher URL: identical failure messages are not repeated", async () => {
    stubTwoAttempts({ abstract: false, first: paywall, second: paywall });
    const err = await resolveSummary({ ...parseInput(PUBLISHER_URL), input: PUBLISHER_URL }).catch(
      (e) => e
    );
    expect(err.message).toBe(
      "The article could not be extracted: Paywall Crossref has no abstract for this paper either."
    );
  });

  it("DOI: a summarizer 5xx without an abstract is reported with its status", async () => {
    stubFetch([
      [isCrossref, () => jsonResponse({ message: { ...crossrefWork, abstract: undefined } })],
      [isRapidApi, () => jsonResponse({}, 503)],
    ]);
    await expect(resolveSummary({ doi: DOI })).rejects.toMatchObject({
      name: "ResolveError",
      code: "extract_failed",
      status: 503,
    });
  });

  it.each([
    ["a network failure", () => Promise.reject(new TypeError("Failed to fetch")), "network"],
    ["a 503", () => jsonResponse({}, 503), "extract_failed"],
    ["a 429", () => jsonResponse({}, 429), "rate_limited"],
  ])("DOI from a publisher URL: does not retry the pasted URL after %s", async (_label, respond, code) => {
    const url = "https://link.springer.com/article/10.1038/nature12373";
    const summarizer = vi.fn(respond);
    stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, summarizer],
    ]);
    const result = await resolveSummary({ ...parseInput(url), input: url });
    expect(summarizer).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ source: "abstract", notice: fallbackNotice(code) });
  });

  it("DOI from a www.doi.org link: a Crossref 404 is reported as DOI not found", async () => {
    const parsed = parseInput("https://www.doi.org/10.1038/missing");
    expect(parsed).toEqual({ doi: "10.1038/missing", url: null });
    const fetchMock = stubFetch([[isCrossref, () => jsonResponse("Resource not found.", 404)]]);
    await expect(resolveSummary(parsed)).rejects.toMatchObject({ code: "doi_not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
      status: 429,
    });
  });

  it("propagates aborts", async () => {
    stubFetch([[isCrossref, () => Promise.reject(abortError())]]);
    await expect(resolveSummary({ doi: DOI })).rejects.toMatchObject({ name: "AbortError" });
  });
});
