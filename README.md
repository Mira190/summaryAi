# SummaryAI

Paste a DOI and get a short AI summary of the paper, together with its title,
authors, journal and year.

SummaryAI is a small single-page app (Vite + Preact + Tailwind CSS). It looks up
paper metadata on [Crossref](https://www.crossref.org/) and summarizes the
article with the
[Article Extractor and Summarizer](https://rapidapi.com/restyler/api/article-extractor-and-summarizer)
API on RapidAPI.

## Features

- **DOI input in any common form**
  - `10.1038/nature12373`
  - `doi:10.1038/nature12373`
  - `https://doi.org/10.1038/nature12373` (also `dx.doi.org`)
  - publisher links that contain a DOI, e.g.
    `https://link.springer.com/article/10.1007/s00125-020-05100-9`
- **Plain article URLs**: any other `http(s)` link is summarized directly (no metadata).
- **Paper metadata** from Crossref: title, authors, journal, year and a DOI link.
- **Abstract fallback**: when the full text cannot be extracted (paywalls, PDFs,
  blocked pages) the app shows the publisher's abstract from Crossref instead,
  labelled "Publisher abstract via Crossref".
- **History**: the last 20 summaries are kept in `localStorage`. Entries can be
  reopened, have their link copied, or be deleted. Re-submitting a DOI or URL
  that already has an AI summary is served from history without new API calls;
  entries that fell back to the abstract are retried.
- **Readable errors** for invalid input, unknown DOIs, a missing or rejected API
  key, exhausted quota (HTTP 429), network problems and failed extraction.

### How a DOI is resolved

1. Fetch metadata from `https://api.crossref.org/works/{doi}`. An unknown DOI
   (404) stops here with "DOI not found" — unless the DOI was taken from a
   publisher URL, in which case that URL is summarized directly instead.
2. Ask the summarizer to summarize `https://doi.org/{doi}`. If that fails and
   the DOI came from a publisher URL, try summarizing that URL too — except
   when another attempt cannot help: missing or rejected API key, exhausted
   quota, network error, or a server error (5xx) from the summarizer.
3. If summarizing still fails and Crossref has an abstract, show the abstract
   instead, with a short note on why: a problem with the summarizer service
   itself (key, quota, connectivity) if one occurred, otherwise why the
   `doi.org` attempt failed.
4. If neither works, show the error and keep whatever metadata was found.

## Getting started

Requires Node.js 22 (20.19+ also works) and npm.

```bash
npm install
cp .env.example .env   # then fill in the values below
npm run dev
```

### Environment variables

| Variable                     | Required | Purpose                                                                                                                             |
| ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_RAPID_API_ARTICLE_KEY` | yes\*    | RapidAPI key subscribed to "Article Extractor and Summarizer".                                                                      |
| `VITE_CROSSREF_MAILTO`       | no       | Your e-mail address. It is sent as `mailto=` so Crossref routes requests to its [polite pool](https://api.crossref.org/swagger-ui/index.html). |

\* Without a key the app still works for DOIs that have an abstract on Crossref
(it shows the abstract), but it cannot summarize full texts or plain URLs.

Vite only reads `.env` at startup, so restart `npm run dev` after changing it.

## Scripts

| Command              | Description                               |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Start the dev server                      |
| `npm run build`      | Production build into `dist/`             |
| `npm run preview`    | Serve the production build locally        |
| `npm run lint`       | ESLint (flat config)                      |
| `npm test`           | Vitest (watch mode locally)               |
| `npm test -- --run`  | Run the test suite once (as CI does)      |
| `npm run test:watch` | Vitest in watch mode                      |

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, tests and the build on
every push and pull request.

## Project structure

```
src/
  components/   Hero, Demo (orchestration), SearchForm, HistoryList, ResultCard, ErrorMessage
  hooks/        useSummary (request state machine), useHistory (localStorage history)
  services/     crossref.js, summarizer.js, resolve.js (DOI/URL flow)
  utils/        doi.js, input.js, jats.js, storage.js
```

## Known limitations

- **The RapidAPI key is visible to visitors.** `VITE_*` variables are embedded
  in the client bundle, so anyone using a deployed build can read the key. For
  a public deployment put the summarizer call behind a serverless proxy that
  holds the key.
- **Paywalled papers** usually cannot be extracted; for those the summary is
  the publisher abstract from Crossref (when the publisher deposited one), not
  an AI summary of the full text.
- Only DOIs registered with Crossref are supported. DOIs from other
  registration agencies (e.g. DataCite datasets) return 404 from Crossref and
  are reported as "DOI not found"; paste the landing-page URL instead.
- Summary quality and quota depend on the RapidAPI plan.
