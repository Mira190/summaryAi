import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { parseInput } from "../utils/input";
import { isAbortError } from "../utils/errors";
import { resolveSummary } from "../services/resolve";

const IDLE = { status: "idle", result: null, error: null };

export const INVALID_INPUT_MESSAGE =
  "That doesn't look like a DOI or a web link. Try something like 10.1038/nature12373 or https://example.com/article.";

function toUserError(err) {
  return {
    code: err?.code ?? "unknown",
    message: err?.message || "Something went wrong. Please try again.",
  };
}

/**
 * State machine for one summary request: idle → loading → success | error.
 * A new submit aborts the previous in-flight request.
 *
 * @param {{ lookup?: (parsed) => object|null, onResult?: (result) => void }} options
 *   lookup: return a cached result (e.g. from history) to skip the network.
 *   onResult: called with every freshly fetched result.
 */
export function useSummary({ lookup, onResult } = {}) {
  const [state, setState] = useState(IDLE);
  const controllerRef = useRef(null);
  const callbacksRef = useRef({ lookup, onResult });

  useEffect(() => {
    callbacksRef.current = { lookup, onResult };
  });

  const abortCurrent = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => abortCurrent, [abortCurrent]);

  const cancel = useCallback(() => {
    abortCurrent();
    setState((current) => (current.status === "loading" ? IDLE : current));
  }, [abortCurrent]);

  const show = useCallback(
    (result) => {
      abortCurrent();
      setState({ status: "success", result, error: null });
    },
    [abortCurrent]
  );

  const submit = useCallback(
    async (rawInput) => {
      abortCurrent();

      const parsed = parseInput(rawInput);
      if (!parsed) {
        setState({
          status: "error",
          result: null,
          error: { code: "invalid_input", message: INVALID_INPUT_MESSAGE },
        });
        return;
      }

      const cached = callbacksRef.current.lookup?.(parsed);
      if (cached) {
        setState({ status: "success", result: cached, error: null });
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: "loading", result: null, error: null });

      try {
        const result = await resolveSummary(
          { ...parsed, input: rawInput.trim() },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        controllerRef.current = null;
        setState({ status: "success", result, error: null });
        callbacksRef.current.onResult?.(result);
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        controllerRef.current = null;
        setState({ status: "error", result: err?.partial ?? null, error: toUserError(err) });
      }
    },
    [abortCurrent]
  );

  return { ...state, submit, cancel, show };
}
