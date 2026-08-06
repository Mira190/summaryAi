import { useEffect, useState } from "react";

import Header from "./components/Header";
import InputBar from "./components/InputBar";
import HistoryList from "./components/HistoryList";
import ProvenanceBanner from "./components/ProvenanceBanner";
import SummaryView from "./components/SummaryView";
import SettingsPanel from "./components/SettingsPanel";
import { loader } from "./assets";
import { classifyInput } from "./lib/doi";
import { resolveDoi, resolveUrl } from "./lib/resolve";
import { summarizeSource } from "./lib/llm";
import {
  getApiKey,
  setApiKey as persistApiKey,
  getUnpaywallEmail,
  setUnpaywallEmail as persistUnpaywallEmail,
  getHistory,
  addHistoryItem,
} from "./lib/storage";

import "./App.css";

const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [unpaywallEmail, setUnpaywallEmailState] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState([]);

  const [status, setStatus] = useState("idle"); // idle | resolving | summarizing | done | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { key, meta, text, provenance, summary }

  useEffect(() => {
    setApiKey(getApiKey());
    setUnpaywallEmailState(getUnpaywallEmail());
    setHistory(getHistory());
  }, []);

  const handleSaveSettings = ({ apiKey: newKey, unpaywallEmail: newEmail }) => {
    persistApiKey(newKey);
    persistUnpaywallEmail(newEmail);
    setApiKey(newKey);
    setUnpaywallEmailState(newEmail);
  };

  const handleSubmit = async (rawInput) => {
    const parsed = classifyInput(rawInput);
    setError("");
    setResult(null);

    if (parsed.type === "invalid") {
      setStatus("error");
      setError("That doesn't look like a DOI (10.xxxx/...) or a valid URL.");
      return;
    }

    const key = parsed.type === "doi" ? `doi:${parsed.doi}` : `url:${parsed.url}`;

    const cached = history.find((item) => item.key === key);
    if (cached) {
      setResult(cached);
      setStatus("done");
      return;
    }

    setStatus("resolving");
    try {
      const resolved =
        parsed.type === "doi"
          ? await resolveDoi(parsed.doi, { unpaywallEmail })
          : await resolveUrl(parsed.url);

      if (!resolved.text) {
        const entry = { key, ...resolved, summary: null, savedAt: Date.now() };
        setResult(entry);
        setStatus("done");
        return;
      }

      setStatus("summarizing");
      const summary = await summarizeSource({
        apiKey,
        meta: resolved.meta,
        text: resolved.text,
        provenance: resolved.provenance,
      });

      const entry = { key, ...resolved, summary, savedAt: Date.now() };
      setResult(entry);
      setHistory(addHistoryItem(entry));
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Something went wrong.");
    }
  };

  const isLoading = status === "resolving" || status === "summarizing";

  return (
    <main>
      <div className="main">
        <div className="gradient" />
      </div>

      <div className="app">
        <Header onOpenSettings={() => setShowSettings(true)} />

        <section className="mt-16 w-full max-w-xl flex flex-col gap-4">
          <InputBar onSubmit={handleSubmit} isLoading={isLoading} />

          <HistoryList items={history} onSelect={(item) => { setResult(item); setStatus("done"); setError(""); }} />

          {status === "resolving" && (
            <p className="font-inter text-sm text-gray-500 text-center">
              Resolving source and checking open-access availability…
            </p>
          )}
          {status === "summarizing" && (
            <div className="flex justify-center">
              <img src={loader} alt="loading" className="w-10 h-10 object-contain" />
            </div>
          )}

          {status === "error" && (
            <p className="font-inter text-sm text-red-600 text-center">{error}</p>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              <ProvenanceBanner provenance={result.provenance} />
              {result.summary ? (
                <SummaryView summary={result.summary} sourceText={result.text} />
              ) : (
                <p className="font-inter text-sm text-gray-600 text-center">
                  No summary was generated — only metadata could be found for this item.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {showSettings && (
        <SettingsPanel
          apiKey={apiKey}
          unpaywallEmail={unpaywallEmail}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
};

export default App;
