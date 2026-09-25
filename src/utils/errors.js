export function isAbortError(err) {
  return err?.name === "AbortError";
}
