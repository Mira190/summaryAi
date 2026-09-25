import { fetchCrossrefWork } from "./crossref";
import { summarizeUrl } from "./summarizer";
import { toDoiUrl } from "../utils/doi";
import { urlKey } from "../utils/input";
import { isAbortError } from "../utils/errors";

/** Error surfaced to the UI. `partial` holds metadata we could still show. */
export class ResolveError extends Error {
  constructor(code, message, { partial = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ResolveError";
    this.code = code;
    this.partial = partial;
  }
}

// Short, user-facing explanations shown when a DOI falls back to the abstract.
const FALLBACK_NOTICES = {
  missing_key: "The summarizer is not configured, so this is the publisher's abstract.",
  rate_limited: "The summarizer's quota is used up; showing the publisher's abstract.",
  extract_failed: "The full text could not be extracted; showing the publisher's abstract.",
  network: "The summarizer could not be reached; showing the publisher's abstract.",
};
const DEFAULT_FALLBACK_NOTICE =
  "The full text could not be summarized; showing the publisher's abstract.";

export function fallbackNotice(code) {
  return FALLBACK_NOTICES[code] ?? DEFAULT_FALLBACK_NOTICE;
}

export function entryId({ doi, url }) {
  return doi ? `doi:${doi}` : `url:${urlKey(url) ?? url}`;
}

function baseResult({ input, doi, url }) {
  return {
    id: entryId({ doi, url }),
    input: input ?? doi ?? url,
    doi: doi ?? null,
    url: url ?? null,
    title: null,
    authors: [],
    journal: null,
    year: null,
    abstract: null,
    summary: null,
    source: null,
    notice: null,
    createdAt: Date.now(),
  };
}

/**
 * Turn parsed input ({ doi } or { url }) into a result:
 *   DOI → Crossref metadata → summarize https://doi.org/<doi>
 *       → on failure fall back to the Crossref abstract (source: "abstract").
 *   DOI extracted from a publisher URL that Crossref does not know (404)
 *       → the DOI was probably mis-parsed, so summarize the URL itself.
 *   URL → summarize the URL.
 * Throws ResolveError (with `partial` metadata when available) or an AbortError.
 */
export async function resolveSummary({ doi, url, input }, { signal } = {}) {
  if (doi) return resolveDoi({ doi, url, input }, { signal });
  return resolveUrl({ url, input }, { signal });
}

async function resolveUrl({ url, input }, { signal }) {
  const result = baseResult({ input, url });
  try {
    const { summary } = await summarizeUrl(url, { signal });
    return { ...result, summary, source: "summary" };
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ResolveError(err.code ?? "unknown", err.message, { cause: err });
  }
}

async function resolveDoi({ doi, url: sourceUrl, input }, { signal }) {
  let result = baseResult({ input, doi, url: toDoiUrl(doi) });

  try {
    const meta = await fetchCrossrefWork(doi, { signal });
    result = { ...result, ...meta, doi: meta.doi || doi };
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (err.code === "not_found") {
      if (sourceUrl) return resolveUrl({ url: sourceUrl, input }, { signal });
      throw new ResolveError("doi_not_found", err.message, { cause: err });
    }
    // Metadata is optional: keep going and try to summarize anyway.
  }

  const hasMeta = Boolean(result.title || result.abstract || result.authors.length);

  try {
    const { summary } = await summarizeUrl(toDoiUrl(result.doi), { signal });
    return { ...result, summary, source: "summary" };
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (result.abstract) {
      return {
        ...result,
        summary: result.abstract,
        source: "abstract",
        notice: fallbackNotice(err.code),
      };
    }
    throw new ResolveError(
      err.code ?? "unknown",
      hasMeta
        ? `${err.message} Crossref has no abstract for this paper either.`
        : err.message,
      { partial: hasMeta ? result : null, cause: err }
    );
  }
}
