# summaryAI

A DOI-native summarizer that treats verifiability as the product: every claim
in a summary is paired with a verbatim quote from the text that was actually
retrieved, and the app tells you plainly which tier of source text it found
(full open-access text, abstract-only, or nothing) instead of quietly
guessing from whatever fragment it could scrape.

## How it works

1. **Resolve.** Paste a DOI or a plain article URL.
   - DOI: looked up against [Crossref](https://api.crossref.org) (metadata +
     abstract, where the publisher deposited one) and
     [OpenAlex](https://openalex.org) (abstract fallback + open-access
     status + citation graph), then [Unpaywall](https://unpaywall.org)
     (best legal open-access full-text location).
   - Plain URL: fetched and converted to clean text via
     [Jina Reader](https://jina.ai/reader/).
2. **Summarize.** The retrieved text is sent directly from your browser to
   the Anthropic API using your own API key (see Settings). The model is
   forced to return structured output where every finding/limitation
   includes an exact quote from the source text.
3. **Verify.** The UI highlights each quote back against the retrieved
   source text, and flags any quote the model claimed that doesn't actually
   appear verbatim in the source.

## No backend, no shared secret

There is no server. Your Anthropic API key and your Unpaywall contact email
are stored only in your browser's `localStorage` and sent directly to those
providers' APIs — never to any server this project runs, because none
exists. This is a deliberate choice: the previous version of this app baked
a shared RapidAPI key into the client bundle, which is fundamentally unsafe
for any client-only app (anything shipped to the browser is public). Bring
your own key instead.

## Coverage caveats (by design, not a bug)

- Crossref abstract coverage is publisher-dependent — some large publishers
  (e.g. Elsevier, ACS) don't deposit abstracts at all. The app falls back to
  OpenAlex and is explicit in the UI when it lands on abstract-only.
- Roughly half of DOIs have no legally accessible open-access full text.
  When that happens, the app says so instead of scraping a paywalled page.

## Development

```bash
npm install
npm run dev     # dev server
npm run build   # production build
npm test        # unit tests (pure lib functions)
```

See `RESEARCH.md` and `PLAN.md` for the research synthesis and phased
implementation plan behind this direction.
