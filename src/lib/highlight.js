// Splits source text into plain/highlighted segments for the grounding quotes a
// model claims to have pulled from it. Pure and testable: no DOM, no HTML strings
// (the source text comes from the open web, so we never build raw HTML from it --
// callers render segments as React text nodes, not dangerouslySetInnerHTML).
export function splitWithHighlights(text, quotes) {
  if (!text || !quotes?.length) return [{ text: text ?? "", highlighted: false }];

  const ranges = [];
  for (const quote of quotes) {
    if (!quote) continue;
    const start = text.indexOf(quote);
    if (start !== -1) ranges.push([start, start + quote.length]);
  }

  if (ranges.length === 0) return [{ text, highlighted: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (const [start, end] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const segments = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), highlighted: false });
    segments.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlighted: false });

  return segments;
}
