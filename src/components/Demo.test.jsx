import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/preact";

import App from "../App";
import { HISTORY_KEY } from "../hooks/useHistory";
import { crossrefWork, isCrossref, isRapidApi, jsonResponse, stubFetch } from "../test/fetch";

const DOI = "10.1038/nature12373";
const TITLE = "Nanometre-scale thermometry in a living cell";

function submit(value) {
  const input = screen.getByLabelText("DOI or article URL");
  fireEvent.input(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Summarize" }));
}

describe("<App /> summary flow", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_RAPID_API_ARTICLE_KEY", "test-key");
    vi.stubEnv("VITE_CROSSREF_MAILTO", "");
  });

  it("summarizes a DOI and shows its metadata", async () => {
    const fetchMock = stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, () => jsonResponse({ summary: "Diamond sensors measure temperature." })],
    ]);
    render(<App />);
    submit(DOI);

    expect(await screen.findByRole("heading", { name: TITLE })).toBeTruthy();
    expect(screen.getByText("Diamond sensors measure temperature.")).toBeTruthy();
    expect(screen.getByText("G. Kucsko, P. C. Maurer, Consortium X")).toBeTruthy();
    expect(screen.getByText("Nature · 2013")).toBeTruthy();
    expect(screen.queryByText("Publisher abstract via Crossref")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Saved to history; submitting again is served from history without fetching.
    const history = screen.getByRole("list", { name: "Recent summaries" });
    expect(within(history).getByText(TITLE)).toBeTruthy();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toHaveLength(1));
    submit(`https://doi.org/${DOI}`);
    expect(await screen.findByRole("heading", { name: TITLE })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("labels the Crossref abstract fallback", async () => {
    stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [isRapidApi, () => jsonResponse({ error: "Paywall" }, 400)],
    ]);
    render(<App />);
    submit(`doi:${DOI}`);

    expect(await screen.findByText("Publisher abstract via Crossref")).toBeTruthy();
    expect(screen.getByText("Sensitive probing of temperature.")).toBeTruthy();
  });

  it("shows a readable error for invalid input without calling any API", async () => {
    const fetchMock = stubFetch([]);
    render(<App />);
    submit("not-a-doi");

    expect(await screen.findByText(/doesn't look like a DOI or a web link/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("copies and deletes history entries without selecting them", async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ url: "https://example.com/old", summary: "Old summary" }])
    );
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Copy link for/ }));
    expect(writeText).toHaveBeenCalledWith("https://example.com/old");
    expect(await screen.findByRole("button", { name: "Link copied" })).toBeTruthy();
    expect(screen.queryByText("Old summary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Delete .* from history/ }));
    expect(screen.queryByRole("list", { name: "Recent summaries" })).toBeNull();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toEqual([]));
  });

  it.each([
    ["writeText rejects", { writeText: vi.fn(() => Promise.reject(new Error("denied"))) }],
    ["the clipboard API is missing", undefined],
  ])("does not claim the link was copied when %s", async (_label, clipboard) => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ url: "https://example.com/old", summary: "Old summary" }])
    );
    vi.stubGlobal("navigator", { ...navigator, clipboard });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Copy link for/ }));
    if (clipboard) await waitFor(() => expect(clipboard.writeText).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("button", { name: "Link copied" })).toBeNull();
    expect(screen.getByRole("button", { name: /Copy link for/ })).toBeTruthy();
  });

  it("marks only the most recently clicked row as copied when copies resolve out of order", async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        { url: "https://example.com/a", summary: "A" },
        { url: "https://example.com/b", summary: "B" },
      ])
    );
    const pending = {};
    const writeText = vi.fn(
      (text) =>
        new Promise((resolve) => {
          pending[text] = resolve;
        })
    );
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link for https://example.com/a" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link for https://example.com/b" }));
    expect(writeText).toHaveBeenCalledTimes(2);

    // The second click resolves first, then the first (stale) one.
    pending["https://example.com/b"]();
    const copied = await screen.findByRole("button", { name: "Link copied" });
    pending["https://example.com/a"]();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const copiedButtons = screen.getAllByRole("button", { name: "Link copied" });
    expect(copiedButtons).toHaveLength(1);
    expect(copiedButtons[0]).toBe(copied);
    expect(within(copied.closest("li")).getByText("https://example.com/b")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link for https://example.com/a" })).toBeTruthy();
  });

  it("does not update after unmount when a copy resolves late", async () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ url: "https://example.com/a", summary: "A" }])
    );
    let resolveCopy;
    const writeText = vi.fn(() => new Promise((resolve) => (resolveCopy = resolve)));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Copy link for/ }));
    unmount();
    resolveCopy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors).not.toHaveBeenCalled();
  });

  it("retries a DOI whose earlier result fell back to the abstract", async () => {
    let summarizerUp = false;
    const fetchMock = stubFetch([
      [isCrossref, () => jsonResponse({ message: crossrefWork })],
      [
        isRapidApi,
        () =>
          summarizerUp
            ? jsonResponse({ summary: "Diamond sensors measure temperature." })
            : jsonResponse({}, 429),
      ],
    ]);
    render(<App />);

    submit(DOI);
    expect(await screen.findByText("Publisher abstract via Crossref")).toBeTruthy();
    expect(screen.getByText("Sensitive probing of temperature.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toMatchObject([
        { doi: DOI, source: "abstract" },
      ])
    );

    summarizerUp = true;
    submit(DOI);
    expect(await screen.findByText("Diamond sensors measure temperature.")).toBeTruthy();
    expect(screen.queryByText("Publisher abstract via Crossref")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toMatchObject([
        { doi: DOI, source: "summary", summary: "Diamond sensors measure temperature." },
      ])
    );
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toHaveLength(1);
  });

  it("summarizes a publisher URL directly when its embedded DOI is unknown to Crossref", async () => {
    const url = "https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1.full.pdf";
    stubFetch([
      [isCrossref, () => jsonResponse("Resource not found.", 404)],
      [isRapidApi, () => jsonResponse({ summary: "Preprint summary." })],
    ]);
    render(<App />);
    submit(url);

    expect(await screen.findByText("Preprint summary.")).toBeTruthy();
    expect(screen.queryByText(/DOI not found/)).toBeNull();
  });

  it("shows a history entry when it is selected", () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ url: "https://example.com/old", summary: "Old summary" }])
    );
    render(<App />);
    fireEvent.click(screen.getByTitle("https://example.com/old"));
    expect(screen.getByText("Old summary")).toBeTruthy();
    expect(screen.getByLabelText("DOI or article URL").value).toBe("https://example.com/old");
  });
});
