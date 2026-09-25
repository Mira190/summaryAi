import { useState } from "preact/hooks";

import { loader } from "../assets";
import { useHistory } from "../hooks/useHistory";
import { useSummary } from "../hooks/useSummary";
import { getApiKey } from "../services/summarizer";
import SearchForm from "./SearchForm";
import HistoryList from "./HistoryList";
import ResultCard from "./ResultCard";
import ErrorMessage from "./ErrorMessage";

const Demo = () => {
  const [input, setInput] = useState("");
  const history = useHistory();
  const { status, result, error, submit, cancel, show } = useSummary({
    lookup: history.find,
    onResult: history.add,
  });
  const loading = status === "loading";
  const keyMissing = !getApiKey();

  const handleSelect = (item) => {
    setInput(item.input || item.doi || item.url || "");
    show(item);
  };

  return (
    <section className="mt-16 w-full max-w-xl">
      <div className="flex flex-col w-full gap-2">
        <SearchForm value={input} onChange={setInput} onSubmit={submit} loading={loading} />
        {keyMissing && (
          <p className="font-satoshi text-sm text-gray-100">
            No summarizer key configured (VITE_RAPID_API_ARTICLE_KEY): DOI lookups will show the
            publisher abstract from Crossref, and plain URLs cannot be summarized.
          </p>
        )}
        <HistoryList
          items={history.items}
          activeId={result?.id}
          onSelect={handleSelect}
          onDelete={history.remove}
        />
      </div>

      <div
        className="my-10 max-w-full flex flex-col justify-center items-center gap-6"
        aria-live="polite"
        aria-busy={loading ? "true" : "false"}
      >
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <img src={loader} alt="Loading summary" className="w-20 h-20 object-contain" />
            <button type="button" onClick={cancel} className="black_btn">
              Cancel
            </button>
          </div>
        )}
        {status === "error" && <ErrorMessage error={error} />}
        {!loading && result && <ResultCard result={result} />}
      </div>
    </section>
  );
};

export default Demo;
