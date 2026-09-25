import { toDoiUrl } from "../utils/doi";
import { stripJats } from "../utils/jats";
import { isAbortError } from "../utils/errors";

const API_BASE = "https://api.crossref.org/works/";

export class CrossrefError extends Error {
  constructor(code, message, { status, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "CrossrefError";
    this.code = code; // "not_found" | "http" | "network" | "invalid_response"
    this.status = status;
  }
}

export function buildCrossrefUrl(doi, mailto = import.meta.env.VITE_CROSSREF_MAILTO) {
  const url = `${API_BASE}${encodeURIComponent(doi)}`;
  return mailto ? `${url}?mailto=${encodeURIComponent(mailto)}` : url;
}

function firstString(value) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() ? first : null;
}

function pickYear(work) {
  for (const field of ["published-print", "published-online", "issued"]) {
    const year = work?.[field]?.["date-parts"]?.[0]?.[0];
    if (Number.isInteger(year)) return year;
  }
  return null;
}

function formatAuthor(author) {
  if (!author || typeof author !== "object") return null;
  const name = [author.given, author.family].filter(Boolean).join(" ").trim();
  return name || (typeof author.name === "string" ? author.name.trim() : null) || null;
}

/** Map a Crossref "message" object to the app's metadata shape. */
export function normalizeWork(work, doi) {
  const title = firstString(work?.title);
  const journal = firstString(work?.["container-title"]);
  const abstract = typeof work?.abstract === "string" ? stripJats(work.abstract) : "";
  const normalizedDoi = (typeof work?.DOI === "string" ? work.DOI : doi).toLowerCase();

  return {
    doi: normalizedDoi,
    title: title ? stripJats(title).replace(/\s+/g, " ") : null,
    authors: Array.isArray(work?.author) ? work.author.map(formatAuthor).filter(Boolean) : [],
    journal: journal ? stripJats(journal).replace(/\s+/g, " ") : null,
    year: pickYear(work),
    abstract: abstract || null,
    url: typeof work?.URL === "string" ? work.URL : toDoiUrl(normalizedDoi),
  };
}

/**
 * Fetch and normalize Crossref metadata for a DOI.
 * Abort errors are rethrown untouched; everything else becomes a CrossrefError.
 */
export async function fetchCrossrefWork(doi, { signal } = {}) {
  let response;
  try {
    response = await fetch(buildCrossrefUrl(doi), {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new CrossrefError("network", "Could not reach Crossref. Check your connection.", {
      cause: err,
    });
  }

  if (response.status === 404) {
    throw new CrossrefError("not_found", `DOI not found: no Crossref record for ${doi}.`, {
      status: 404,
    });
  }
  if (!response.ok) {
    throw new CrossrefError("http", `Crossref returned an error (HTTP ${response.status}).`, {
      status: response.status,
    });
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new CrossrefError("invalid_response", "Crossref returned an unreadable response.", {
      cause: err,
    });
  }
  if (!body?.message || typeof body.message !== "object") {
    throw new CrossrefError("invalid_response", "Crossref returned an unexpected response.");
  }
  return normalizeWork(body.message, doi);
}
