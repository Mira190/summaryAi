import { fetchWithTimeout } from "./http";

// OpenAlex API: free, keyless for light use (polite pool via mailto param recommended).
// https://api.openalex.org/works/doi:{doi}
// OpenAlex stores abstracts as a word->positions inverted index (not raw text) specifically
// to avoid redistributing publisher copyrighted text verbatim -- reconstruct client-side.

export function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return null;

  const positions = [];
  for (const [word, idxs] of Object.entries(invertedIndex)) {
    for (const idx of idxs) positions[idx] = word;
  }
  const text = positions.join(" ").trim();
  return text || null;
}

export async function fetchOpenAlexWork(doi, { mailto } = {}) {
  const params = mailto ? `?mailto=${encodeURIComponent(mailto)}` : "";
  const res = await fetchWithTimeout(
    `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}${params}`
  );

  if (res.status === 404) return null;
  if (res.status === 429) throw new Error("OpenAlex rate limit hit — try again shortly.");
  if (!res.ok) throw new Error(`OpenAlex lookup failed (HTTP ${res.status})`);

  const work = await res.json();

  return {
    title: work.title ?? null,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    isOa: work.open_access?.is_oa ?? false,
    oaUrl: work.open_access?.oa_url ?? null,
    citedByCount: work.cited_by_count ?? null,
    relatedWorks: (work.related_works ?? []).slice(0, 5),
    topics: (work.topics ?? []).slice(0, 3).map((t) => t.display_name),
  };
}
