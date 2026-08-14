import { fetchWithTimeout } from "./http";

// Crossref REST API: free, keyless, no rate-limit auth required.
// https://api.crossref.org/works/{doi}
// Coverage caveat (verified 2026-08): abstract field is publisher-deposited and wildly
// uneven — MDPI/Frontiers/PLoS/SAGE near 100%, Elsevier and ACS deposit ~0%. Callers
// must treat a missing abstract here as expected, not an error, and fall back to OpenAlex.

function stripJats(xmlish) {
  if (!xmlish) return null;
  return xmlish
    .replace(/<\/?jats:[^>]+>/g, "")
    .replace(/<\/?[a-z]+>/gi, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

export async function fetchCrossrefWork(doi) {
  const res = await fetchWithTimeout(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { Accept: "application/json" },
  });

  if (res.status === 404) return null;
  if (res.status === 429) throw new Error("Crossref rate limit hit — try again shortly.");
  if (!res.ok) throw new Error(`Crossref lookup failed (HTTP ${res.status})`);

  const { message } = await res.json();

  return {
    doi: message.DOI,
    title: message.title?.[0] ?? null,
    authors: (message.author ?? []).map((a) =>
      [a.given, a.family].filter(Boolean).join(" ") || a.name
    ),
    abstract: stripJats(message.abstract),
    publisher: message.publisher ?? null,
    container: message["container-title"]?.[0] ?? null,
    issued: message.issued?.["date-parts"]?.[0]?.join("-") ?? null,
    license: message.license?.[0]?.URL ?? null,
    url: message.URL ?? `https://doi.org/${message.DOI}`,
    referenceCount: message["is-referenced-by-count"] ?? null,
  };
}
