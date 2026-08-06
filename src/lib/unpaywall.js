// Unpaywall API: free, keyless, "polite pool" via required email query param.
// https://api.unpaywall.org/v2/{doi}?email=...  (100,000 calls/day per verified docs)

export async function fetchUnpaywall(doi, email) {
  if (!email) throw new Error("Unpaywall requires a contact email (set once in Settings).");

  const res = await fetch(
    `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Unpaywall lookup failed (HTTP ${res.status})`);

  const data = await res.json();
  const loc = data.best_oa_location;

  return {
    isOa: data.is_oa ?? false,
    oaStatus: data.oa_status ?? null,
    pdfUrl: loc?.url_for_pdf ?? null,
    landingUrl: loc?.url ?? null,
    license: loc?.license ?? null,
  };
}
