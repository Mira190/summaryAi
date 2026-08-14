// Thin fetch wrapper shared by every external API call in lib/. Without a timeout, a
// hung request (dead DNS, stalled TCP) leaves the UI stuck on a spinner forever --
// every network call in this app should go through here rather than raw fetch().
const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(`Request to ${new URL(url).hostname} timed out after ${timeoutMs / 1000}s.`);
    }
    throw new Error(`Network request to ${new URL(url).hostname} failed: ${err.message}`);
  }
}
