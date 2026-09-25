import { isAbortError } from "../utils/errors";

const HOST = "article-extractor-and-summarizer.p.rapidapi.com";

export class SummarizerError extends Error {
  constructor(code, message, { status, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "SummarizerError";
    // "missing_key" | "key_rejected" | "rate_limited" | "extract_failed" | "network"
    this.code = code;
    this.status = status;
  }
}

export function getApiKey() {
  return import.meta.env.VITE_RAPID_API_ARTICLE_KEY || "";
}

export function buildSummarizeUrl(url) {
  return `https://${HOST}/summarize?url=${encodeURIComponent(url)}&length=3`;
}

/**
 * Summarize the article at `url` with the RapidAPI Article Extractor and Summarizer.
 * Resolves to { summary }. Abort errors are rethrown untouched.
 */
export async function summarizeUrl(url, { signal, apiKey = getApiKey() } = {}) {
  if (!apiKey) {
    throw new SummarizerError(
      "missing_key",
      "The summarizer is not configured: no RapidAPI key is set."
    );
  }

  let response;
  try {
    response = await fetch(buildSummarizeUrl(url), {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": HOST,
      },
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new SummarizerError(
      "network",
      "Could not reach the summarizer service. Check your connection and try again.",
      { cause: err }
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    if (isAbortError(err)) throw err;
  }

  if (response.status === 429) {
    throw new SummarizerError(
      "rate_limited",
      "The summarizer's request quota is used up. Please wait a bit and try again.",
      { status: 429 }
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new SummarizerError(
      "key_rejected",
      "The summarizer rejected the RapidAPI key (invalid key or no active subscription).",
      { status: response.status }
    );
  }

  const apiMessage =
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.message === "string" && data.message) ||
    "";

  if (!response.ok) {
    throw new SummarizerError(
      "extract_failed",
      apiMessage
        ? `The article could not be extracted: ${apiMessage}`
        : `The article could not be extracted (HTTP ${response.status}).`,
      { status: response.status }
    );
  }

  const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
  if (!summary) {
    throw new SummarizerError(
      "extract_failed",
      apiMessage
        ? `The article could not be summarized: ${apiMessage}`
        : "The summarizer returned no summary for this page.",
      { status: response.status }
    );
  }
  return { summary };
}
