// Jina AI Reader: free, keyless, converts a URL (HTML or PDF) into clean markdown text.
// Used for the plain-URL path and for fetching an OA PDF/landing page found via Unpaywall.
// https://r.jina.ai/<target-url>

export async function extractReadableText(url) {
  const res = await fetch(`https://r.jina.ai/${url}`);
  if (!res.ok) throw new Error(`Reader extraction failed (HTTP ${res.status})`);
  return res.text();
}
