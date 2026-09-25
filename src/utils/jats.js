// Crossref abstracts are JATS XML fragments such as
// "<jats:title>Abstract</jats:title><jats:p>Text with <jats:italic>x</jats:italic></jats:p>".
// stripJats turns them (or plain HTML) into readable plain text with
// paragraphs separated by a blank line.

const LEADING_HEADING_RE =
  /^\s*<(?:jats:)?title\b[^>]*>\s*(?:abstract|summary)\s*[.:]?\s*<\/(?:jats:)?title>/i;
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

export function stripJats(markup) {
  if (typeof markup !== "string" || !markup.trim()) return "";
  const text = markup
    .replace(LEADING_HEADING_RE, "")
    .replace(BLOCK_TAG_RE, "\n")
    .replace(ANY_TAG_RE, "");

  return decodeEntities(text)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
