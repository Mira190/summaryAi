const LEVEL_INFO = {
  "full-text-url": {
    label: "Full page text retrieved",
    tone: "bg-green-50 border-green-200 text-green-800",
  },
  "full-text-oa": {
    label: "Full open-access text retrieved",
    tone: "bg-green-50 border-green-200 text-green-800",
  },
  "abstract-only": {
    label: "Abstract only — full text was not accessible",
    tone: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "metadata-only": {
    label: "Metadata only — no abstract or full text found",
    tone: "bg-red-50 border-red-200 text-red-800",
  },
  unavailable: {
    label: "This DOI could not be resolved",
    tone: "bg-red-50 border-red-200 text-red-800",
  },
};

const SOURCE_LABELS = {
  crossref: "Crossref",
  openalex: "OpenAlex",
  unpaywall: "Unpaywall",
  reader: "page reader",
};

const ProvenanceBanner = ({ provenance }) => {
  const info = LEVEL_INFO[provenance.level] ?? LEVEL_INFO.unavailable;
  const sourceNames = Object.entries(provenance.sources ?? {})
    .filter(([, used]) => used)
    .map(([name]) => SOURCE_LABELS[name] ?? name);

  return (
    <div className={`rounded-lg border px-4 py-2 text-sm font-inter ${info.tone}`}>
      <span className="font-semibold">{info.label}</span>
      {sourceNames.length > 0 && (
        <span className="opacity-80"> · looked up via {sourceNames.join(", ")}</span>
      )}
      {provenance.level === "abstract-only" && (
        <p className="mt-1 opacity-90">
          The summary below reflects only what the abstract states, not the full paper.
        </p>
      )}
    </div>
  );
};

export default ProvenanceBanner;
