import { parseDoi } from "./doi";

const BARE_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]|$)/i;

/** Parse an http(s) URL; a bare "example.com/path" gets https:// added. Returns href or null. */
export function parseHttpUrl(input) {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && BARE_DOMAIN_RE.test(value)) {
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
 * Classify user input. DOIs win over URLs (a doi.org or publisher URL that
 * embeds a DOI is treated as a DOI). Returns { doi, url } or null.
 */
export function parseInput(input) {
  const doi = parseDoi(input);
  if (doi) return { doi, url: null };
  const url = parseHttpUrl(input);
  if (url) return { doi: null, url };
  return null;
}
