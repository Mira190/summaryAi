import { vi } from "vitest";

/** Minimal Response stand-in for stubbed fetch calls. */
export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  };
}

export function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

/**
 * Stub global fetch with a router: each handler is [predicate(url), responder(url, init)].
 * Unmatched requests fail the test loudly.
 */
export function stubFetch(routes) {
  const fetchMock = vi.fn(async (url, init) => {
    for (const [match, respond] of routes) {
      if (match(String(url))) return respond(String(url), init);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const isCrossref = (url) => url.startsWith("https://api.crossref.org/works/");
export const isRapidApi = (url) =>
  url.startsWith("https://article-extractor-and-summarizer.p.rapidapi.com/summarize");

export const crossrefWork = {
  DOI: "10.1038/nature12373",
  URL: "https://doi.org/10.1038/nature12373",
  title: ["Nanometre-scale thermometry in a living cell"],
  author: [
    { given: "G.", family: "Kucsko" },
    { given: "P. C.", family: "Maurer" },
    { name: "Consortium X" },
  ],
  "container-title": ["Nature"],
  "published-print": { "date-parts": [[2013, 8, 1]] },
  "published-online": { "date-parts": [[2013, 7, 31]] },
  issued: { "date-parts": [[2013, 7, 31]] },
  abstract: "<jats:title>Abstract</jats:title><jats:p>Sensitive probing of temperature.</jats:p>",
};
