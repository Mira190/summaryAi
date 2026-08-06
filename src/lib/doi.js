// DOI regex per Crossref's recommended pattern (case-insensitive, handles most real-world DOIs)
const DOI_RE = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i;

// Strip a doi.org/dx.doi.org URL down to the bare DOI, or match a bare DOI / "doi:" prefix.
export function extractDoi(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/^https?:\/\/(dx\.)?doi\.org\/(.+)$/i);
  const candidate = urlMatch ? decodeURIComponent(urlMatch[2]) : trimmed.replace(/^doi:/i, "");

  const match = candidate.match(DOI_RE);
  return match ? match[1].replace(/[.,;]+$/, "") : null;
}

export function classifyInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return { type: "invalid" };

  const doi = extractDoi(trimmed);
  if (doi) return { type: "doi", doi };

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { type: "url", url: url.toString() };
    }
  } catch {
    // not a URL either
  }

  return { type: "invalid" };
}
