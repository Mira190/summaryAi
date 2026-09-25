import { beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeUrl } from "./summarizer";
import { abortError, jsonResponse, stubFetch } from "../test/fetch";

describe("summarizeUrl", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "test-key");
  });

  it("calls RapidAPI with the encoded URL and headers", async () => {
    const fetchMock = stubFetch([[() => true, () => jsonResponse({ summary: "  Short summary.  " })]]);
    await expect(summarizeUrl("https://example.com/a?b=1&c=2")).resolves.toEqual({
      summary: "Short summary.",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://article-extractor-and-summarizer.p.rapidapi.com/summarize?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1%26c%3D2&length=3"
    );
    expect(init.headers).toEqual({
      "X-RapidAPI-Key": "test-key",
      "X-RapidAPI-Host": "article-extractor-and-summarizer.p.rapidapi.com",
    });
  });

  it("throws missing_key without sending a request when the key is empty", async () => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "");
    const fetchMock = stubFetch([]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({
      name: "SummarizerError",
      code: "missing_key",
      message: "The summarizer is not configured: no RapidAPI key is set.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps 429 to rate_limited", async () => {
    stubFetch([[() => true, () => jsonResponse({ message: "Too many requests" }, 429)]]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  });

  it("maps 403 to a rejected-key error", async () => {
    stubFetch([[() => true, () => jsonResponse({ message: "You are not subscribed" }, 403)]]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({
      code: "key_rejected",
      message: expect.stringMatching(/rejected/),
    });
  });

  it("maps 401 to key_rejected", async () => {
    stubFetch([[() => true, () => jsonResponse({ message: "Invalid API key" }, 401)]]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({
      code: "key_rejected",
      status: 401,
    });
  });

  it("maps API errors to extract_failed with the API message", async () => {
    stubFetch([[() => true, () => jsonResponse({ error: "Unable to fetch article" }, 400)]]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({
      code: "extract_failed",
      message: expect.stringMatching(/Unable to fetch article/),
    });
  });

  it("treats a 200 without a summary as extract_failed", async () => {
    stubFetch([[() => true, () => jsonResponse({ summary: "" })]]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({ code: "extract_failed" });
  });

  it("maps fetch failures to network", async () => {
    stubFetch([[() => true, () => Promise.reject(new TypeError("Failed to fetch"))]]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({ code: "network" });
  });

  it("rethrows aborts untouched", async () => {
    stubFetch([[() => true, () => Promise.reject(abortError())]]);
    await expect(summarizeUrl("https://example.com")).rejects.toMatchObject({ name: "AbortError" });
  });
});
