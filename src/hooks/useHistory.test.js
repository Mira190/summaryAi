import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/preact";

import {
  HISTORY_KEY,
  HISTORY_LIMIT,
  addEntry,
  findCachedSummary,
  findEntry,
  migrateHistory,
  useHistory,
} from "./useHistory";

const entry = (n, extra = {}) => ({
  id: `url:https://example.com/${n}`,
  input: `https://example.com/${n}`,
  doi: null,
  url: `https://example.com/${n}`,
  title: null,
  authors: [],
  journal: null,
  year: null,
  abstract: null,
  summary: `Summary ${n}`,
  source: "summary",
  notice: null,
  createdAt: n,
  ...extra,
});

const stored = () => JSON.parse(window.localStorage.getItem(HISTORY_KEY));

describe("history helpers", () => {
  it("migrates the legacy { url, summary } shape and drops invalid entries", () => {
    const migrated = migrateHistory([
      { url: "https://example.com/old", summary: "Old summary" },
      { url: "https://example.com/no-summary" },
      { summary: "no url" },
      { url: "not a url", summary: "x" },
      null,
      "string",
      { url: "https://example.com/old/", summary: "duplicate" },
    ]);
    expect(migrated).toEqual([
      expect.objectContaining({
        id: "url:https://example.com/old",
        url: "https://example.com/old",
        summary: "Old summary",
        source: "summary",
        authors: [],
      }),
    ]);
  });

  it("returns [] for non-array data", () => {
    expect(migrateHistory({ url: "x" })).toEqual([]);
    expect(migrateHistory(null)).toEqual([]);
  });

  it("adds newest first, dedupes by DOI or URL, caps the list and never mutates", () => {
    const list = Object.freeze([entry(1), entry(2)]);
    const updated = addEntry(list, entry(2, { summary: "fresh" }));
    expect(updated.map((e) => e.summary)).toEqual(["fresh", "Summary 1"]);

    const doiA = entry(3, { id: "doi:10.1/a", doi: "10.1/a", url: "https://doi.org/10.1/a" });
    const doiB = { ...doiA, id: "doi:10.1/a", summary: "newer" };
    expect(addEntry([doiA], doiB)).toEqual([doiB]);

    let big = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) big = addEntry(big, entry(i));
    expect(big).toHaveLength(HISTORY_LIMIT);
    expect(big[0].createdAt).toBe(HISTORY_LIMIT + 4);
  });

  it("finds entries by DOI or normalized URL", () => {
    const list = [entry(1), entry(2, { id: "doi:10.1/b", doi: "10.1/b", url: "https://doi.org/10.1/b" })];
    expect(findEntry(list, { doi: "10.1/b" })?.summary).toBe("Summary 2");
    expect(findEntry(list, { url: "https://EXAMPLE.com/1/" })?.summary).toBe("Summary 1");
    expect(findEntry(list, { doi: "10.1/zzz" })).toBeNull();
    // A DOI miss falls back to the URL (e.g. a publisher URL that was summarized directly).
    expect(findEntry(list, { doi: "10.1/zzz", url: "https://example.com/1" })?.summary).toBe(
      "Summary 1"
    );
  });

  it("only serves AI summaries as cache hits", () => {
    const summary = entry(1, { id: "doi:10.1/a", doi: "10.1/a", url: "https://doi.org/10.1/a" });
    const fallback = entry(2, {
      id: "doi:10.1/b",
      doi: "10.1/b",
      url: "https://doi.org/10.1/b",
      source: "abstract",
    });
    const list = [summary, fallback];
    expect(findCachedSummary(list, { doi: "10.1/a" })).toBe(summary);
    expect(findCachedSummary(list, { doi: "10.1/b" })).toBeNull();
    expect(findEntry(list, { doi: "10.1/b" })).toBe(fallback);
  });

  it("checks the URL independently when the DOI hit is only an abstract", () => {
    const fallback = entry(1, {
      id: "doi:10.1/x",
      doi: "10.1/x",
      url: "https://doi.org/10.1/x",
      source: "abstract",
    });
    const urlSummary = entry(2, { url: "https://publisher.example/y", id: "url:https://publisher.example/y" });
    const list = [fallback, urlSummary];
    expect(findCachedSummary(list, { doi: "10.1/x", url: "https://publisher.example/y" })).toBe(
      urlSummary
    );
    expect(findCachedSummary(list, { doi: "10.1/x", url: null })).toBeNull();
  });
});

describe("useHistory", () => {
  it("self-heals corrupt storage", () => {
    window.localStorage.setItem(HISTORY_KEY, "{corrupt");
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it("loads legacy data and rewrites it in the new shape", () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ url: "https://example.com/old", summary: "Old" }])
    );
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ id: "url:https://example.com/old", source: "summary" });
  });

  it("adds, dedupes, finds and removes entries", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.add(entry(1)));
    act(() => result.current.add(entry(2)));
    act(() => result.current.add(entry(1, { summary: "again" })));
    expect(result.current.items.map((e) => e.summary)).toEqual(["again", "Summary 2"]);
    expect(result.current.find({ url: "https://example.com/2" })?.summary).toBe("Summary 2");

    act(() => result.current.remove("url:https://example.com/2"));
    expect(result.current.items.map((e) => e.id)).toEqual(["url:https://example.com/1"]);
    expect(stored()).toHaveLength(1);
  });

  it("ignores results without a summary", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.add({ ...entry(1), summary: null }));
    expect(result.current.items).toEqual([]);
  });
});
