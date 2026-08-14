# Implementation plan: summaryAI

Companion to RESEARCH.md. Phase 0 is what has already shipped on this
branch; Phases 1+ are scoped for a future engineering agent.

## Phase 0 — Shipped in this restructure

- `src/lib/doi.js` — DOI/URL input classification, no network, tested with
  node one-liners (not a formal test suite yet — see Phase 1).
- `src/lib/crossref.js`, `openalex.js`, `unpaywall.js` — metadata/abstract/
  OA-location fetchers, each independently fallible and caught by the
  orchestrator.
- `src/lib/resolve.js` — the Crossref → OpenAlex → Unpaywall → Jina Reader
  fallback chain, producing an explicit `provenance.level`.
- `src/lib/extract.js` — Jina Reader (`r.jina.ai`) text extraction for
  plain URLs and for OA links found via Unpaywall/OpenAlex.
- `src/lib/llm.js` — direct browser→Anthropic call (BYO-key), forced
  structured tool-use output with per-claim `quote` grounding.
- `src/lib/highlight.js` — pure text-segment highlighting of grounded
  quotes against retrieved source text (verified with node one-liners,
  including the case where a claimed quote is *not* actually present).
- `src/lib/storage.js` — localStorage helpers with try/catch (fixes the
  audit-flagged unguarded `JSON.parse`).
- New UI: `Header`, `InputBar`, `SettingsPanel`, `ProvenanceBanner`,
  `SummaryView` (with source-text-with-highlights toggle), `HistoryList`.
- Removed: RTK Query/Redux (no longer needed for a single BYO-key fetch
  flow), the RapidAPI dependency, `dist/` from git tracking, the
  misattributed "unichatal" logo asset, unused `copy.svg`/`tick.svg`/
  `grid.svg`, and the false "AI-Powered GPT4" marketing copy.
- Fixed: favicon path (moved to `public/favicon.ico` so Vite actually
  serves it at `/favicon.ico`), the `.reverse()`-mutates-state bug (no
  longer applicable — history is stored newest-first already).
- Verified: `npm run build` succeeds; dev server renders correctly in a
  headless-Chromium screenshot pass (home page, settings modal, invalid-
  input error state). **Not verified live**: the actual DOI-resolution
  network round-trip and the LLM call, because this sandbox's outbound
  network is restricted to an allowlist that doesn't include
  `api.crossref.org`/`api.openalex.org`/`api.unpaywall.org`/`r.jina.ai`/
  `api.anthropic.com`. A future agent with normal network access (or a
  human running it locally/on a real deploy) needs to smoke-test the
  live pipeline end-to-end before calling this production-ready.

## Phase 1 — Harden the MVP

Status: items 2–5 are done. Item 1 (the live network smoke test) is still
blocked in the sandbox this was built in — see "still open" below.

1. **Live smoke test — still open, needs an agent/human with real network
   access.** Test: a DOI with a known-open abstract-only paper (should
   show amber "abstract-only" banner), a DOI with known full OA text
   (should show green "full-text-oa" and highlighted grounded quotes), a
   DOI that doesn't resolve (should show a clean "unavailable" state, not
   a crash), a plain non-DOI URL, and a bad/expired Anthropic key (should
   surface the API's error message, not a blank screen).
2. **Unit tests — done.** Vitest added (`npm test`); 24 tests across
   `src/lib/doi.test.js`, `highlight.test.js`, `openalex.test.js` covering
   `extractDoi`/`classifyInput`, `splitWithHighlights` (including overlap-
   merging and the not-found-verbatim case), and `reconstructAbstract`.
3. **Timeouts/error handling — done.** `src/lib/http.js` adds a shared
   `fetchWithTimeout` (15s default, 30s for Reader extraction, 60s for the
   LLM call) used by every external call in `crossref.js`/`openalex.js`/
   `unpaywall.js`/`extract.js`/`llm.js`. Each also has explicit `429`
   messages and `llm.js` additionally has a `401` ("check your key")
   message rather than a generic `HTTP {status}`.
4. **Accessibility — done.** `SettingsPanel` now has focus-on-open,
   Tab focus-trapping, Escape-to-close, and backdrop-click-to-close —
   verified live via Playwright (focus lands on the key field on open;
   Escape and backdrop click both close it; 6 Tab presses stay inside the
   dialog). `HistoryList` buttons now carry `aria-label`/`title` with the
   full DOI/URL, not just the truncated display title.
5. **`npm audit` — done.** Bumped `vite` 4→8, `@preact/preset-vite`
   2.5→2.10, `autoprefixer`, and `preact` to latest; kept `tailwindcss` on
   the latest 3.x (not the v4 rewrite, to avoid an unrelated config
   migration). `npm audit` now reports 0 vulnerabilities (was 13-15,
   entirely in the esbuild/babel/glob dev-tooling chain, not runtime app
   code). Verified via full rebuild + test run + a live Playwright pass
   (zero console/page errors, identical rendering) that nothing broke
   across the 4-major-version jump.
6. **Dependency correctness fix.** While bumping deps, `npm install -D`
   briefly moved `preact` into `devDependencies` (a runtime dependency
   being installed as a dev flag) — caught and corrected before commit.
   Worth double-checking `package.json`'s dependencies/devDependencies
   split after any future bulk dependency bump.

## Phase 2 — Citation-graph comparison (the #4 differentiator from RESEARCH.md, not yet built)

Goal: for a resolved DOI, show 3–5 related papers (via OpenAlex
`related_works` or Semantic Scholar's citation graph, both free) with a
structured side-by-side on population/method/effect — the feature Elicit
charges $49/mo for, done paper-centric instead of query-centric.

- New `src/lib/semanticscholar.js` or reuse OpenAlex `related_works` IDs
  (already fetched in `resolve.js`, currently discarded after populating
  `meta.topics`/`citedByCount` — wire them into a "Related papers" section).
- For each related paper, a lightweight version of the same resolve→
  summarize pipeline, but likely capped to metadata+abstract only (full
  resolution for 5 papers per lookup would multiply BYO-key spend 5x;
  needs an explicit user opt-in, e.g. "Compare with related papers" button
  rather than automatic).
- UI: a comparison table/cards, not a wall of text — this is where the
  "genuinely differentiated" bet lives, so don't rush it; it's worth a
  dedicated design pass rather than bolting onto `SummaryView`.

## Phase 3 — Quality/faithfulness evaluation harness

RESEARCH.md flags this as an open research item (ROUGE/faithfulness
literature not yet fully synthesized). Concretely, before claiming
"grounded summaries" as a marketing point beyond what's already
implemented:

- The current grounding check (`SummaryView.jsx:GroundedItem`, `found =
  sourceText?.includes(quote)`) is a simple substring check — good enough
  to catch outright fabrication, but won't catch subtler unfaithfulness
  (a real quote used to support a claim it doesn't actually establish).
  A future agent should research and potentially wire in an NLI-based
  entailment check (SummaC-style) or an LLM-judge second pass, and should
  finish the open research item on hallucination-rate literature first to
  calibrate how much this matters for the target use case.
- Consider a small internal eval set (10-20 papers with known abstracts/
  findings) to regression-test summary quality after any prompt change in
  `llm.js`.

## Phase 4 — Deployment

- Static hosting (Vercel/Netlify/GitHub Pages) — no backend needed, so
  deployment is just "serve the Vite build output."
- Explicitly do **not** add analytics/telemetry that would undercut the
  privacy/BYO-key positioning without a clear, disclosed reason.
- `.gitignore` now correctly excludes `dist/`; confirm the CI/deploy
  config (if one is added) builds fresh rather than expecting a committed
  `dist/`.

## Explicit non-goals (per competitive research anti-recommendations)

- Don't build a search/discovery engine — Elicit, Consensus, Undermind,
  FutureHouse, and Ai2 Asta are all funded/institutional and still
  struggle on recall; not a solo-competitive space.
- Don't build another generic chat-with-PDF — fully commoditized, race to
  the bottom on cloned ChatPDF-style tools.
- Don't promise or implement paywall circumvention — scrape only what
  Unpaywall/OpenAlex certify as legally open-access; this is both a legal
  necessity (see RESEARCH.md §5's publisher-AI-licensing context) and a
  trust necessity (the whole pitch is "we're honest about what we
  retrieved").

## Outstanding decisions for a human (or a future turn with the user)

1. **The leaked RapidAPI key is still in git history** (old commits, not
   current `dist/` which is now untracked going forward). Scrubbing it
   requires rewriting history and force-pushing, which is a destructive,
   hard-to-reverse action this session did not take without explicit
   sign-off. Recommend: rotate/revoke the key on the RapidAPI account
   (independent of this repo) and decide separately whether history
   rewrite is worth it for a repo already public.
2. **Single-provider LLM lock-in.** Only Anthropic is wired up in
   `llm.js`. Multi-provider BYO-key (OpenAI-compatible, local models) is a
   natural extension but was deliberately not built now — no evidence yet
   that users need it, and it would add a provider-abstraction layer
   before there's a second real caller of it.
3. **Whether to merge in the three open research items from RESEARCH.md**
   before treating this plan as final — none of them block Phase 1
   hardening, but Phase 2/3 scoping could shift once they land.
