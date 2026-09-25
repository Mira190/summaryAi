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
 *   URL → summarize the URL.
 * Throws ResolveError (with `partial` metadata when available) or an AbortError.
 */
export async function resolveSummary({ doi, url, input }, { signal } = {}) {
  if (doi) return resolveDoi({ doi, input }, { signal });
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

async function resolveDoi({ doi, input }, { signal }) {
  let result = baseResult({ input, doi, url: toDoiUrl(doi) });

  try {
    const meta = await fetchCrossrefWork(doi, { signal });
    result = { ...result, ...meta, doi: meta.doi || doi };
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (err.code === "not_found") {
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
        notice: `Full-text summary unavailable: ${err.message}`,
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
