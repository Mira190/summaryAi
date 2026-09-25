// Crossref abstracts are JATS XML fragments such as
// "<jats:title>Abstract</jats:title><jats:p>Text with <jats:italic>x</jats:italic></jats:p>".
// stripJats turns them (or plain HTML) into readable plain text with
// paragraphs separated by a blank line.

// With { dropHeading: true } (used for abstracts only), a first paragraph
// that is just an "Abstract"/"Summary" heading is dropped, wherever the
// heading sits (bare, or inside <jats:sec>).
const HEADING_ONLY_RE = /^(?:abstract|summary)\s*[:.]?$/i;
const BLOCK_TAG_RE =
  /<\/?(?:jats:)?(?:p|sec|title|list|list-item|abstract|trans-abstract|disp-quote|br|div|h[1-6]|li|ul|ol)\b[^>]*\/?>/gi;
const ANY_TAG_RE = /<\/?[a-z][^>]*>/gi;

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X"
          ? parseInt(name.slice(2), 16)
          : parseInt(name.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

export function stripJats(markup, { dropHeading = false } = {}) {
  if (typeof markup !== "string" || !markup.trim()) return "";
  const text = markup.replace(BLOCK_TAG_RE, "\n").replace(ANY_TAG_RE, "");

  const paragraphs = decodeEntities(text)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (dropHeading && paragraphs.length > 0 && HEADING_ONLY_RE.test(paragraphs[0])) {
    paragraphs.shift();
  }

  return paragraphs.join("\n\n");
}
