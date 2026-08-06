# Blindspot analysis: summaryAI

Research synthesis for the pivot from a generic URL-summarizer clone to a
DOI-native, provenance-grounded scholarly summarizer. Written so another
engineering agent can pick up work without re-deriving the problem space.

Status: sections 1–3 and 5 are backed by verified sources (cited inline).
Section 4 (provider-limit specifics, deeper licensing case law, and
summarization-quality benchmark literature) was still being researched by
background agents when this document was written and should be finished
and merged in before relying on it for architecture decisions — see
"Open research items" at the end.

---

## 1. What the codebase actually was (before this restructure)

This repo was a near-verbatim clone of the JavaScript Mastery "Sumz" /
"Summize" tutorial (React + RapidAPI + Redux Toolkit Query). Confirmed by
searching for the same file structure, asset names, and RapidAPI endpoint
across dozens of public GitHub repos, including one literally named
`summaryAI` (github.com/paoloyao/summaryAI) and a Medium walkthrough
("Build an OpenAI Article Summarizer using Rapid API with React, Tailwind
CSS, and Redux"). **The pre-restructure app had zero technical or product
differentiation** — treat it as a beginner tutorial, not a product with
existing users or identity.

### Critical finding: leaked API key

`dist/assets/index-c85080df.js` (committed to git) contained a live
RapidAPI key in plaintext, because:
- `.gitignore` had `dist` commented out, so the build output was committed.
- Architecturally, `VITE_`-prefixed env vars are inlined into the client
  bundle by Vite's design — this is not a mistake specific to this repo,
  it's what happens to *any* secret referenced this way in a client-only
  app. There was no backend, so there was no way to protect the key at all.
- **This is almost certainly a repeated footgun across the whole tutorial
  lineage**, not a one-off — every clone that follows the tutorial as
  written ships the same class of bug.
- Action taken: key is no longer baked into the app (see §5, BYO-key
  architecture). The specific leaked key should still be revoked/rotated
  on RapidAPI by whoever owns that account — this repo restructure cannot
  do that itself, and rewriting git history to scrub it requires a
  force-push decision the user should make explicitly.

### Other bugs fixed by the restructure (full list was in the working audit)

- `allArticles.reverse()` mutated React state in place on every render.
- `JSON.parse(localStorage.getItem(...))` with no try/catch — corrupted
  storage blanked the whole app on mount.
- Dedup by exact URL string equality (missed `http`/`https`, trailing
  slash, query-param variants).
- Deprecated `e.keyCode`, list `key` props reused across a reversed array,
  clickable `<div>`s without keyboard/aria semantics.
- Hero copy claimed "AI-Powered GPT4" and "Accurate summaries" — neither
  claim was true or measured; the actual backend was an opaque third-party
  RapidAPI service of unverified provenance.
- README claimed DOI input; the app only ever accepted a URL.

These are now moot (the components were rewritten), but they're recorded
here because the same class of mistakes (state-mutation-in-render, unsafe
JSON.parse, false marketing claims) is worth grep-checking for in any code
a future agent adds.

---

## 2. Why "paste a URL, get a summary" has no moat (verified 2026-08)

Generic URL summarization is now a built-in browser feature, free, at the
point of reading:
- Chrome: Gemini "Summarize Page" built into the omnibox.
  ([Gemini in Chrome](https://gemini.google/overview/gemini-in-chrome/))
- Edge: Copilot Mode summarizes pages and compares across tabs, free for
  all Edge users.
- Safari: Apple Intelligence summarizes in Reader/Highlights.
- Kagi: free Universal Summarizer for members; API at $0.030/1k tokens.
  ([docs](https://help.kagi.com/kagi/api/summarizer.html))

**Implication:** anything built on "extract text from a URL, summarize it"
alone is commodity, not product. The wedge has to be in what a browser
can't do — DOI-native retrieval, transparent provenance, structured
scholarly facets, citation-graph context, and grounding you can verify.

---

## 3. Competitive landscape and differentiation (verified 2026-08)

Full agent report is preserved in this session's scratchpad; key
conclusions:

### Existing tools and their gaps
- **Semantic Scholar TLDR** (free) — one-sentence extreme summaries,
  CS/biomedical only, Ai2 itself warns not to rely on it for consequential
  decisions.
- **Scholarcy** (~$5/mo) — flashcard-style structured summaries; users
  explicitly complained when a redesign *removed* the highlighted
  original-text-per-section view in favor of generic AI prose. Direct
  signal that provenance-preserving UX is valued and was taken away.
- **Elicit** ($22M Series A, Feb 2025, ~$100M valuation) — strong
  extraction accuracy (81.4% vs 86.7% human) but a 2025 Cochrane study
  found only 37.9% search sensitivity vs 93.5% for traditional systematic
  search; non-reproducible search runs; alerts locked behind Pro/Team.
- **Consensus** ($11.5M Series A) — evidence-weighted Q&A, no deep-linking
  into cited PDFs to see *why* a paper was cited.
- **SciSpace** — worst billing reputation in the group (opaque credit
  burn, refused refunds); a clinical researcher reported fabricated
  citations and wrong co-authors.
- **NotebookLM** (free, 50 queries/day) — the free-tier gorilla to
  differentiate against. Citations point to the *document*, not a
  page/span; no DOI ingestion (manual upload only); no public API; long
  docs get truncated in audio generation.
- **ChatPDF and clones** — fully commoditized; ~94% page-reference
  accuracy at best; hallucinated citations persist.
- **Zotero AI plugins** (PapersGPT, Aria, etc.) — real demand for BYO-key,
  local-library privacy, but plugins are fragile and get abandoned (Aria
  was not updated for Zotero 8).

### Recurring user complaints (the actual gap map)
1. Faithfulness on methods/stats — measured hallucination rates ~0.6–1.6
   per summary depending on model
   ([arXiv 2310.10627](https://arxiv.org/pdf/2310.10627)).
2. False "this is missing" claims when content is in another section.
3. Fabricated references — GPT-3.5 39.6%, GPT-4 28.6%, Bard 91.4%
   hallucination rate on systematic-review references
   ([PMC11153973](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11153973/)).
4. Paywalls silently degrading to abstract-only synthesis with no
   disclosure — the single biggest structural barrier
   ([IntuitionLabs](https://intuitionlabs.ai/articles/full-text-access-barriers-ai-research-tools)).
5. Limitations sections ignored or their provenance destroyed.
6. Non-English literature under-served by English-only pipelines.
7. Billing trust — opaque credits, vanishing free tiers, surprise charges.

### Differentiation ranked (gap size × solo feasibility × defensibility)
1. **Claim-level citations with span highlighting + honest provenance.**
   Nobody in the field does this well end-to-end. → implemented in this
   restructure (`SummaryView`, `highlight.js`, `ProvenanceBanner`).
2. **DOI-native resolution with an honest "what tier did we actually get"
   banner**, rather than silently degrading. → implemented
   (`resolve.js`).
3. **Permanent limitations/uncertainty panel**, grounded in quotes, not
   inferred. → implemented (part of `SummaryView`).
4. **Citation-graph comparison** via free OpenAlex/Semantic Scholar APIs —
   what Elicit charges $49/mo for, done paper-centric. → **not yet
   implemented**, see PLAN.md Phase 2.
5. **BYO-key, flat/zero-COGS pricing** — proven demand in the Zotero
   plugin ecosystem, sidesteps the billing-trust complaints that plague
   SciSpace/Scholarcy. → implemented (no backend at all).

### Business/legal context shaping the space (2024–2026)
- Publishers are monetizing full text themselves via AI licensing deals
  (Wiley ~$44M, Informa/T&F ~$75M with Microsoft) and will police
  unlicensed scraping. Small players must stay on OA + user-provided text
  + metadata — this is both an ethical and a legal necessity, and it's
  exactly why the provenance-honesty approach is not just a UX nicety.
- Data infrastructure (OpenAlex, Semantic Scholar/Asta, Crossref,
  Unpaywall) is free or near-free. **The moat is not data access — it's
  trust, UX, and grounding.**
- scite's 2023 acquisition by Research Solutions (~$20.9M, on ~$3.6M ARR)
  is the canonical exit pattern in this space: distribution + document-
  delivery rights buyer, not a product-quality bet.

---

## 4. DOI resolution pipeline: verified facts

- **Crossref** (`api.crossref.org`, free, keyless): abstract coverage is
  publisher-dependent, not a technical limitation. A 2026 preregistered
  audit found 75.4% abstract coverage in a curated biomedical sample
  ([arXiv 2606.24897](https://arxiv.org/pdf/2606.24897)), but MDPI/
  Frontiers/PLoS/SAGE ≈100% while **Elsevier and ACS deposit ~0%**. A
  separate corpus-wide analysis of the full historical Crossref data file
  (2.6B records, all time) found only ~11% have an abstract — recent,
  open-friendly-publisher papers are well covered; the long tail is not.
  **Do not assume Crossref will have an abstract.**
- **OpenAlex** (`api.openalex.org`, free, `mailto` param recommended):
  stores abstracts as a word→positions inverted index specifically to
  avoid redistributing publisher-copyrighted text verbatim — reconstruct
  client-side (`openalex.js:reconstructAbstract`). Also the free source
  for OA status and citation graph (`related_works`, `cited_by_count`).
- **Unpaywall** (`api.unpaywall.org`, free, no key, email required as a
  query param for "polite pool" access): rate limit 100,000 calls/day.
  For bulk use they recommend downloading the full data snapshot instead
  of hammering the live API.
  ([github.com/api-evangelist/unpaywall](https://github.com/api-evangelist/unpaywall))
- **Practical implication (implemented):** fallback chain Crossref →
  OpenAlex → Unpaywall → Jina Reader extraction of the OA link, with an
  explicit provenance tier surfaced in the UI at every step
  (`full-text-oa` / `abstract-only` / `metadata-only` / `unavailable`).
  Never silently degrade.

---

## 5. Architecture decision: BYO-key, no backend

Given the leaked-key finding in §1, and given this restructure has no
access to a live LLM API key or backend infrastructure, the chosen
architecture is:

- **No server.** Static-hosted SPA (Vite build), deployable to any static
  host (Vercel/Netlify/GitHub Pages).
- **User supplies their own Anthropic API key**, entered in Settings,
  stored only in `localStorage`, sent directly from the browser to
  `api.anthropic.com` using the documented
  `anthropic-dangerous-direct-browser-access` header — the supported
  pattern for BYO-key browser apps. This is not a workaround; it's how
  Anthropic's API explicitly supports this use case.
- This directly fixes the architectural flaw that caused the original key
  leak (no shared secret ever exists in the bundle) and implements
  differentiator #5 from §3 (BYO-key pricing/privacy) at the same time.
- Structured output is forced via Anthropic's tool-use mechanism
  (`tool_choice: {type: "tool", name: "structured_summary"}`), requiring
  every `finding`/`limitation` to carry a `quote` field the UI can verify
  against the retrieved source text (`llm.js`, `highlight.js`). If the
  model's claimed quote doesn't actually appear verbatim in the source
  text, the UI flags it in red rather than silently trusting it
  (`SummaryView.jsx:GroundedItem`).

Trade-off accepted: users need their own Anthropic key to get summaries at
all (metadata/provenance/DOI-resolution works with zero setup). This is a
deliberate bet that the target user (researcher, technical reader) already
has or is willing to get an API key, in exchange for zero operating cost
and no shared-secret attack surface.

---

## Open research items (not yet folded in — follow up before relying on them)

Three deeper research passes were in flight when implementation started
and were not fully synthesized into this document. A future agent should
complete and merge these before making further architecture bets:

1. **RapidAPI "Article Extractor and Summarizer" specifics** (the service
   the old app used) — exact free-tier quota, underlying model, and
   reliability. Direct verification was blocked by RapidAPI's bot
   protection (403 on direct fetch) in this session; largely moot now
   since the pipeline no longer depends on it, but useful context if a
   fallback extraction provider is ever needed for non-DOI URLs beyond
   Jina Reader.
2. **Deeper DOI/licensing legal analysis** — EU DSM Article 4 TDM
   exception specifics, US fair-use posture for AI summarization in
   2025-2026, and the status of any notable publisher-vs-AI litigation.
   Relevant if this project ever summarizes text beyond what Unpaywall
   certifies as open-access (e.g., user-uploaded PDFs of paywalled
   papers — currently out of scope, see PLAN.md).
3. **Summarization quality/faithfulness benchmark literature** — ROUGE's
   known poor correlation with faithfulness, hallucination taxonomy,
   long-document "lost in the middle" effects, and which automated
   faithfulness metrics (QAFactEval, SummaC, FActScore-style atomic claim
   checking) are worth wiring in as an automated eval harness for this
   project's own output quality (see PLAN.md Phase 3).
