import { fetchWithTimeout } from "./http";

// Jina AI Reader: free, keyless, converts a URL (HTML or PDF) into clean markdown text.
// Used for the plain-URL path and for fetching an OA PDF/landing page found via Unpaywall.
// https://r.jina.ai/<target-url>
// PDFs and slow origin sites take longer than a plain JSON API call, hence the longer timeout.
const EXTRACT_TIMEOUT_MS = 30000;

export async function extractReadableText(url) {
  const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, {}, EXTRACT_TIMEOUT_MS);
  if (res.status === 429) throw new Error("Reader rate limit hit — try again shortly.");
  if (!res.ok) throw new Error(`Reader extraction failed (HTTP ${res.status})`);
  return res.text();
}
