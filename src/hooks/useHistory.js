import { useCallback, useEffect, useState } from "preact/hooks";

import { parseDoi } from "../utils/doi";
import { parseHttpUrl, urlKey } from "../utils/input";
import { safeGet, safeSet } from "../utils/storage";
import { entryId } from "../services/resolve";

export const HISTORY_KEY = "articles";
export const HISTORY_LIMIT = 20;

const str = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Validate one stored entry. Accepts the current shape and the legacy
 * `{ url, summary }` shape; returns null for anything unusable.
 */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const summary = str(raw.summary);
  if (!summary) return null;

  const doi = str(raw.doi) ? parseDoi(raw.doi) : null;
  const url = str(raw.url) ? parseHttpUrl(raw.url) : null;
  if (!doi && !url) return null;

  return {
    id: str(raw.id) ?? entryId({ doi, url }),
    input: str(raw.input) ?? doi ?? url,
    doi,
    url,
    title: str(raw.title),
    authors: Array.isArray(raw.authors) ? raw.authors.map(str).filter(Boolean) : [],
    journal: str(raw.journal),
    year: Number.isInteger(raw.year) ? raw.year : null,
    abstract: str(raw.abstract),
    summary,
    source: raw.source === "abstract" ? "abstract" : "summary",
    notice: str(raw.notice),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
  };
}

export function isSameEntry(a, b) {
  if (a.id && a.id === b.id) return true;
  if (a.doi && b.doi) return a.doi === b.doi;
  return Boolean(a.url && b.url && urlKey(a.url) === urlKey(b.url));
}

/** Newest first, deduped, capped at HISTORY_LIMIT. Never mutates `list`. */
export function addEntry(list, entry) {
  return [entry, ...list.filter((item) => !isSameEntry(item, entry))].slice(0, HISTORY_LIMIT);
}

export function migrateHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (entry && !out.some((existing) => isSameEntry(existing, entry))) out.push(entry);
    if (out.length === HISTORY_LIMIT) break;
  }
  return out;
}

const findByDoi = (list, doi) => (doi ? list.find((item) => item.doi === doi) ?? null : null);

function findByUrl(list, url) {
  const key = url ? urlKey(url) : null;
  if (!key) return null;
  return list.find((item) => item.url && urlKey(item.url) === key) ?? null;
}

/** Find a history entry by DOI, falling back to the (normalized) URL. */
export function findEntry(list, { doi, url } = {}) {
  return findByDoi(list, doi) ?? findByUrl(list, url);
}

/**
 * Like findEntry, but only returns real AI summaries. Abstract-fallback
 * entries stay in history (and can be selected) but are never served as a
 * cache hit, so re-submitting retries the summarizer. The DOI and URL are
 * checked independently: an abstract entry for the DOI does not hide an AI
 * summary stored under the URL.
 */
export function findCachedSummary(list, { doi, url } = {}) {
  const byDoi = findByDoi(list, doi);
  if (byDoi?.source === "summary") return byDoi;
  const byUrl = findByUrl(list, url);
  return byUrl?.source === "summary" ? byUrl : null;
}

/** Summary history persisted in localStorage under "articles". */
export function useHistory() {
  // Lazy initializer: read + migrate once; corrupt data falls back to [].
  const [items, setItems] = useState(() => migrateHistory(safeGet(HISTORY_KEY, [])));

  // Persist every change (this also rewrites migrated/cleaned legacy data).
  useEffect(() => {
    safeSet(HISTORY_KEY, items);
  }, [items]);

  const add = useCallback((entry) => {
    const normalized = normalizeEntry(entry);
    if (normalized) setItems((list) => addEntry(list, normalized));
  }, []);

  const remove = useCallback((id) => {
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const find = useCallback((query) => findEntry(items, query), [items]);
  const findCached = useCallback((query) => findCachedSummary(items, query), [items]);

  return { items, add, remove, clear, find, findCached };
}
