// DOI parsing helpers.
// A DOI is "10.<registrant>/<suffix>"; the suffix may contain almost any
// printable character, so we match greedily and then trim what is clearly
// not part of it (trailing punctuation, URL query strings, publisher view
// suffixes such as "/full" or "/pdf").

const DOI_RE = /10\.\d{4,9}\/[^\s"<>]+/i;
const PREFIX_RE = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)/i;
const URL_RE = /^https?:\/\//i;
const TRAILING_PUNCT_RE = /[.,;:!?'"\]}]+$/;
const PUBLISHER_SUFFIX_RE = /\/(?:full|abstract|pdf|epdf|pdfdirect|html|meta|summary)$/i;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripTrailing(doi) {
  let out = doi;
  for (;;) {
    const before = out;
    out = out.replace(TRAILING_PUNCT_RE, "");
    // Only drop a closing parenthesis when it is unbalanced, so DOIs like
    // 10.1002/(sici)1097-4636(199706)35:4<...> keep their own parentheses.
    while (out.endsWith(")") && count(out, "(") < count(out, ")")) {
      out = out.slice(0, -1);
    }
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

  let doi = match[0];
  if (isUrl) {
    // Inside a URL, "?", "#" and "&" start the query string / fragment.
    doi = doi.split(/[?#&]/)[0];
    doi = doi.replace(PUBLISHER_SUFFIX_RE, "");
  }
  doi = stripTrailing(doi);

  return DOI_RE.test(doi) ? doi.toLowerCase() : null;
}

/** True when the whole input is a DOI (optionally with a doi:/doi.org prefix). */
export function isDoi(input) {
  if (typeof input !== "string") return false;
  const doi = parseDoi(input);
  if (!doi) return false;
  const rest = input.trim().replace(PREFIX_RE, "").trim();
  return stripTrailing(safeDecode(rest)).toLowerCase() === doi;
}

/** Resolver URL for a DOI, e.g. https://doi.org/10.1038/nature12373 */
export function toDoiUrl(doi) {
  return `https://doi.org/${encodeURI(doi).replace(/[?#]/g, encodeURIComponent)}`;
}
