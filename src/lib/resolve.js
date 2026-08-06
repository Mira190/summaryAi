import { fetchCrossrefWork } from "./crossref";
import { fetchOpenAlexWork } from "./openalex";
import { fetchUnpaywall } from "./unpaywall";
import { extractReadableText } from "./extract";

// Resolves a DOI into the best legally-accessible text we can find, and is explicit
// about what tier we landed on -- this honesty is the product's core differentiator,
// so never silently downgrade without recording it in `provenance`.
//
// Chain: Crossref (metadata + abstract, if the publisher deposited one)
//     -> OpenAlex (abstract fallback + OA status + citation graph)
//     -> Unpaywall (best legal open-access full-text location)
//     -> Jina Reader (fetch + convert that OA location to text)
export async function resolveDoi(doi, { unpaywallEmail } = {}) {
  const [crossref, openalex] = await Promise.all([
    fetchCrossrefWork(doi).catch(() => null),
    fetchOpenAlexWork(doi, { mailto: unpaywallEmail }).catch(() => null),
  ]);

  if (!crossref && !openalex) {
    return {
      meta: { doi },
      text: null,
      provenance: { level: "unavailable", sources: {} },
    };
  }

  const meta = {
    doi,
    title: crossref?.title ?? openalex?.title ?? null,
    authors: crossref?.authors ?? [],
    publisher: crossref?.publisher ?? null,
    container: crossref?.container ?? null,
    issued: crossref?.issued ?? null,
    url: crossref?.url ?? `https://doi.org/${doi}`,
    citedByCount: openalex?.citedByCount ?? null,
    topics: openalex?.topics ?? [],
  };

  const abstract = crossref?.abstract ?? openalex?.abstract ?? null;

  let unpaywall = null;
  if (unpaywallEmail) {
    unpaywall = await fetchUnpaywall(doi, unpaywallEmail).catch(() => null);
  }

  const oaUrl = unpaywall?.pdfUrl || unpaywall?.landingUrl || openalex?.oaUrl || null;

  if (oaUrl) {
    try {
      const fullText = await extractReadableText(oaUrl);
      if (fullText && fullText.length > 500) {
        return {
          meta,
          text: fullText,
          provenance: {
            level: "full-text-oa",
            sources: { crossref: !!crossref, openalex: !!openalex, unpaywall: !!unpaywall },
            fullTextUrl: oaUrl,
          },
        };
      }
    } catch {
      // OA link existed but extraction failed (bot block, malformed PDF, etc.) --
      // fall through to abstract-only rather than surfacing an opaque error.
    }
  }

  if (abstract) {
    return {
      meta,
      text: abstract,
      provenance: {
        level: "abstract-only",
        sources: { crossref: !!crossref, openalex: !!openalex, unpaywall: !!unpaywall },
      },
    };
  }

  return {
    meta,
    text: null,
    provenance: {
      level: "metadata-only",
      sources: { crossref: !!crossref, openalex: !!openalex, unpaywall: !!unpaywall },
    },
  };
}

export async function resolveUrl(url) {
  const text = await extractReadableText(url);
  return {
    meta: { url },
    text,
    provenance: { level: "full-text-url", sources: { reader: true } },
  };
}
