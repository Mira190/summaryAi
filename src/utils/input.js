import { parseDoi } from "./doi";

// "example.com/path" without a scheme. The last label must be a 2+ letter TLD,
// so things like "10.123/abc" (which new URL() would read as the IPv4
// shorthand 10.0.0.123) are not mistaken for links.
const BARE_DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i;
// A scheme such as "https:" (but not "example.com:8080", which is a port).
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const DOI_ORG_HOST_RE = /^(?:dx\.)?doi\.org$/i;

/** Parse an http(s) URL; a bare "example.com/path" gets https:// added. Returns href or null. */
export function parseHttpUrl(input) {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (!SCHEME_RE.test(value)) {
    // Without an explicit scheme only accept real domain names, never IPs.
    if (!BARE_DOMAIN_RE.test(value)) return null;
    value = `https://${value}`;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Comparison key for URLs: lowercase host, no fragment, no trailing slash. */
export function urlKey(input) {
  const href = parseHttpUrl(input);
  if (!href) return null;
  const url = new URL(href);
  url.hash = "";
  return url.href.replace(/\/+$/, "").replace(/^http:/, "https:");
}

/**
 * Classify user input. Returns { doi, url } or null.
 * - bare DOI / "doi:" / doi.org link → { doi, url: null }
 * - other http(s) URL embedding a DOI → { doi, url } (the URL is kept so the
 *   caller can fall back to it if the extracted DOI turns out to be wrong)
 * - any other http(s) URL → { doi: null, url }
 */
export function parseInput(input) {
  const doi = parseDoi(input);
  const url = parseHttpUrl(input);
  if (doi) {
    const keepUrl = url && !DOI_ORG_HOST_RE.test(new URL(url).hostname);
    return { doi, url: keepUrl ? url : null };
  }
  if (url) return { doi: null, url };
  return null;
}
