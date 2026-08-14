// Calls the Anthropic Messages API directly from the browser with the user's own key.
// No backend, no shared secret baked into the bundle -- the key never leaves the
// user's machine except to go straight to Anthropic. This is the documented pattern
// for BYO-key browser apps (anthropic-dangerous-direct-browser-access header).
//
// Forces structured, quote-grounded output via tool_choice so every claim the model
// makes can be traced back to a verbatim span in the source text -- that grounding is
// what the UI highlights, and it's the core defense against unverifiable hallucination.

import { fetchWithTimeout } from "./http";

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_SOURCE_CHARS = 60000; // keep BYO-key spend predictable; long-form is a later iteration
const LLM_TIMEOUT_MS = 60000; // summarizing a long source can take a while

const SUMMARY_TOOL = {
  name: "structured_summary",
  description: "Return a structured, quote-grounded summary of the supplied source text.",
  input_schema: {
    type: "object",
    properties: {
      tldr: { type: "string", description: "One or two sentence plain-language summary." },
      research_question: { type: "string", description: "What question/problem the work addresses. Empty string if not applicable." },
      methods: { type: "string", description: "How the work was done. Empty string if not stated in the provided text." },
      findings: {
        type: "array",
        description: "Key results, each grounded in an exact quote from the source text.",
        items: {
          type: "object",
          properties: {
            claim: { type: "string" },
            quote: { type: "string", description: "Verbatim substring copied exactly from the source text that supports this claim." },
          },
          required: ["claim", "quote"],
        },
      },
      limitations: {
        type: "array",
        description: "Stated caveats, limitations, or scope restrictions, each grounded in a quote.",
        items: {
          type: "object",
          properties: {
            claim: { type: "string" },
            quote: { type: "string" },
          },
          required: ["claim", "quote"],
        },
      },
      confidence_note: {
        type: "string",
        description: "Explicit caveat if this summary is based only on an abstract (not full text), or if anything is uncertain.",
      },
    },
    required: ["tldr", "findings", "limitations", "confidence_note"],
  },
};

function buildPrompt({ meta, text, provenance }) {
  const header = [
    meta.title && `Title: ${meta.title}`,
    meta.authors?.length && `Authors: ${meta.authors.join(", ")}`,
    meta.doi && `DOI: ${meta.doi}`,
  ].filter(Boolean).join("\n");

  const truncated = text.length > MAX_SOURCE_CHARS;
  const body = truncated ? text.slice(0, MAX_SOURCE_CHARS) : text;

  return [
    header,
    `\nSource text tier: ${provenance.level}${provenance.level === "abstract-only" ? " (full text was not accessible -- this is the abstract only)" : ""}${truncated ? "\n[Source text truncated for length]" : ""}`,
    "\n--- SOURCE TEXT ---\n",
    body,
  ].join("\n");
}

const SYSTEM_PROMPT = `You summarize scholarly articles and web content with strict grounding.
Rules:
- Every item in "findings" and "limitations" must include a "quote" field that is an EXACT verbatim substring copied character-for-character from the provided source text. Do not paraphrase in the quote field. If you cannot find a supporting quote, do not include the claim.
- Never state a number, statistic, or citation that does not literally appear in the source text.
- If the source text tier is "abstract-only", do not describe methods or findings beyond what the abstract itself states, and say so plainly in confidence_note.
- If limitations are not explicitly stated in the source text, leave the limitations array empty rather than inferring them.`;

export async function summarizeSource({ apiKey, model = "claude-sonnet-5", meta, text, provenance }) {
  if (!apiKey) throw new Error("No API key set. Add your Anthropic API key in Settings.");
  if (!text) throw new Error("No source text was available to summarize.");

  const res = await fetchWithTimeout(
    API_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [SUMMARY_TOOL],
        tool_choice: { type: "tool", name: "structured_summary" },
        messages: [{ role: "user", content: buildPrompt({ meta, text, provenance }) }],
      }),
    },
    LLM_TIMEOUT_MS
  );

  if (res.status === 401) throw new Error("Anthropic rejected the API key — check it in Settings.");
  if (res.status === 429) throw new Error("Anthropic rate limit hit — wait a moment and try again.");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Anthropic API error (HTTP ${res.status})`);
  }

  const data = await res.json();
  const toolUse = data.content?.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Model did not return a structured summary.");

  return toolUse.input;
}
