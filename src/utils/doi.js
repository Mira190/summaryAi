// DOI parsing helpers.
// A DOI is "10.<registrant>/<suffix>"; the suffix may contain almost any
// printable character, so we match greedily and then trim what is clearly
// not part of it (trailing punctuation, URL query strings, publisher view
// suffixes such as "/full", "/fulltext.html" or ".full.pdf").
// "<" and ">" are allowed because SICI-style DOIs contain them.

const DOI_RE = /10\.\d{4,9}\/[^\s"]+/i;
// doi.org resolver hosts: doi.org, dx.doi.org, www.doi.org
const DOI_ORG_HOST = String.raw`(?:dx\.|www\.)?doi\.org`;
const DOI_ORG_HOST_RE = new RegExp(`^${DOI_ORG_HOST}$`, "i");
const PREFIX_RE = new RegExp(String.raw`^(?:doi:\s*|https?:\/\/${DOI_ORG_HOST}\/)`, "i");
const URL_RE = /^https?:\/\//i;
// SICI DOIs contain "<" and ">" but never end with them, so an enclosing
// "<10.x/y>" is trimmed here.
const TRAILING_PUNCT_RE = /[.,;:!?'"\]}/<>]+$/;
// Publisher "view" suffixes that follow the DOI in landing-page URLs, e.g.
// /full, /abstract, /pdf, /fulltext.html, .full, .full.pdf, .pdf
const PUBLISHER_SUFFIX_RE =
  /(?:\/(?:full|fulltext|abstract|pdf|epdf|pdfdirect|html|meta|summary)(?:\.html?)?|\.full(?:\.pdf|\.html?)?|\.pdf)$/i;

/** True when `href` is an http(s) link on a doi.org resolver host. */
export function isDoiOrgUrl(href) {
  try {
    const url = new URL(href);
    return (url.protocol === "http:" || url.protocol === "https:") && DOI_ORG_HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Trim what cannot be the end of a DOI, repeating until nothing changes:
 * trailing punctuation, an unbalanced closing parenthesis (balanced ones, as
 * in 10.1002/(sici)1097-4636(199706)..., are kept) and, inside URLs,
 * publisher view suffixes.
 */
function cleanDoi(doi, isUrl) {
  let out = doi;
  for (;;) {
    const before = out;
    out = out.replace(TRAILING_PUNCT_RE, "");
    if (out.endsWith(")") && count(out, "(") < count(out, ")")) out = out.slice(0, -1);
    if (isUrl) out = out.replace(PUBLISHER_SUFFIX_RE, "");
    if (out === before) return out;
  }
}

function count(str, ch) {
  return str.split(ch).length - 1;
}

/**
 * Extract a DOI from free-form input: a bare DOI, "doi:10.x/y",
 * "https://doi.org/10.x/y" or a publisher URL containing a DOI.
 * Returns the lowercase DOI or null.
 */
export function parseDoi(input) {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (!value) return null;

  const isUrl = URL_RE.test(value);
  value = value.replace(PREFIX_RE, "").trim();
  if (isUrl) value = safeDecode(value);

  const match = value.match(DOI_RE);
  if (!match) return null;

  // Inside a URL, "?", "#" and "&" start the query string / fragment.
  const raw = isUrl ? match[0].split(/[?#&]/)[0] : match[0];
  const doi = cleanDoi(raw, isUrl);

  return DOI_RE.test(doi) ? doi.toLowerCase() : null;
}

/** Resolver URL for a DOI, e.g. https://doi.org/10.1038/nature12373 */
export function toDoiUrl(doi) {
  return `https://doi.org/${encodeURI(doi).replace(/[?#]/g, encodeURIComponent)}`;
}
