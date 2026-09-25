import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/preact";

import { useSummary } from "./useSummary";
import { crossrefWork, isCrossref, isRapidApi, jsonResponse, stubFetch } from "../test/fetch";

const DOI = "10.1038/nature12373";

describe("useSummary", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "test-key");
    vi.stubEnv("VITE_CROSSREF_MAILTO", "");
  });

  it("goes idle → loading → success and reports the result", async () => {
    stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, () => jsonResponse({ summary: "Summary." })],
    ]);
    const onResult = vi.fn();
    const { result } = renderHook(() => useSummary({ onResult }));
    expect(result.current.status).toBe("idle");

    let pending;
    act(() => {
      pending = result.current.submit(`https://doi.org/${DOI}`);
    });
    expect(result.current.status).toBe("loading");
    await act(() => pending);

    expect(result.current.status).toBe("success");
    expect(result.current.result).toMatchObject({ doi: DOI, summary: "Summary.", input: `https://doi.org/${DOI}` });
    expect(onResult).toHaveBeenCalledWith(result.current.result);
  });

  it("rejects invalid input without any request", async () => {
    const fetchMock = stubFetch([]);
    const { result } = renderHook(() => useSummary());
    await act(() => result.current.submit("not-a-doi"));
    expect(result.current.status).toBe("error");
    expect(result.current.error.code).toBe("invalid_input");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves cached results from lookup without fetching", async () => {
    const fetchMock = stubFetch([]);
    const cached = { id: `doi:${DOI}`, doi: DOI, summary: "Cached." };
    const lookup = vi.fn(() => cached);
    const { result } = renderHook(() => useSummary({ lookup }));
    await act(() => result.current.submit(`doi:${DOI}`));
    expect(lookup).toHaveBeenCalledWith({ doi: DOI, url: null });
    expect(result.current.result).toBe(cached);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps partial metadata on error", async () => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "");
    stubFetch([[isCrossref, () => jsonResponse({ message: { ...crossrefWork, abstract: undefined } })]]);
    const { result } = renderHook(() => useSummary());
    await act(() => result.current.submit(DOI));
    expect(result.current.status).toBe("error");
    expect(result.current.error.code).toBe("missing_key");
    expect(result.current.result.title).toBe("Nanometre-scale thermometry in a living cell");
  });

  it("aborts the previous request when a new one is submitted", async () => {
    const signals = [];
    stubFetch([
      [
        (url) => url.includes("first"),
        (_url, init) => {
          signals.push(init.signal);
          return new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            );
          });
        },
      ],
      [isRapidApi, () => jsonResponse({ summary: "Second." })],
    ]);
    const onResult = vi.fn();
    const { result } = renderHook(() => useSummary({ onResult }));

    let first;
    act(() => {
      first = result.current.submit("https://example.com/first");
    });
    await act(() => result.current.submit("https://example.com/second"));
    await act(() => first);

    expect(signals[0].aborted).toBe(true);
    expect(result.current.status).toBe("success");
    expect(result.current.result.summary).toBe("Second.");
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("cancel() returns to idle", async () => {
    stubFetch([
      [
        () => true,
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            );
          }),
      ],
    ]);
    const { result } = renderHook(() => useSummary());
    let pending;
    act(() => {
      pending = result.current.submit("https://example.com/slow");
    });
    expect(result.current.status).toBe("loading");
    act(() => result.current.cancel());
    await act(() => pending);
    await waitFor(() => expect(result.current.status).toBe("idle"));
  });
});
