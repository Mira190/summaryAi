import { useState } from "react";
import { splitWithHighlights } from "../lib/highlight";

const GroundedItem = ({ claim, quote, sourceText }) => {
  const found = sourceText?.includes(quote);
  return (
    <li className="flex flex-col gap-1">
      <p className="font-inter text-sm text-gray-800">{claim}</p>
      {quote && (
        <blockquote
          className={`text-xs font-inter italic border-l-2 pl-2 ${
            found ? "border-blue-400 text-gray-600" : "border-red-300 text-red-500"
          }`}
        >
          &ldquo;{quote}&rdquo;
          {!found && <span className="not-italic ml-1">(quote not found verbatim in source — flagged)</span>}
        </blockquote>
      )}
    </li>
  );
};

const SummaryView = ({ summary, sourceText }) => {
  const [showSource, setShowSource] = useState(false);
  const allQuotes = [...summary.findings, ...summary.limitations].map((f) => f.quote);

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="summary_box flex flex-col gap-2">
        <h2 className="font-satoshi font-bold text-gray-700 text-lg">
          <span className="blue_gradient">TL;DR</span>
        </h2>
        <p className="font-inter text-sm text-gray-800">{summary.tldr}</p>
      </div>

      {summary.confidence_note && (
        <p className="font-inter text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {summary.confidence_note}
        </p>
      )}

      {summary.research_question && (
        <div>
          <h3 className="font-satoshi font-semibold text-gray-700 text-sm mb-1">Research question</h3>
          <p className="font-inter text-sm text-gray-800">{summary.research_question}</p>
        </div>
      )}

      {summary.methods && (
        <div>
          <h3 className="font-satoshi font-semibold text-gray-700 text-sm mb-1">Methods</h3>
          <p className="font-inter text-sm text-gray-800">{summary.methods}</p>
        </div>
      )}

      {summary.findings.length > 0 && (
        <div>
          <h3 className="font-satoshi font-semibold text-gray-700 text-sm mb-2">Findings</h3>
          <ul className="flex flex-col gap-3">
            {summary.findings.map((f, i) => (
              <GroundedItem key={`finding-${i}`} claim={f.claim} quote={f.quote} sourceText={sourceText} />
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-satoshi font-semibold text-gray-700 text-sm mb-2">Limitations</h3>
        {summary.limitations.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {summary.limitations.map((l, i) => (
              <GroundedItem key={`limitation-${i}`} claim={l.claim} quote={l.quote} sourceText={sourceText} />
            ))}
          </ul>
        ) : (
          <p className="font-inter text-xs text-gray-500">
            No limitations were explicitly stated in the retrieved text.
          </p>
        )}
      </div>

      {sourceText && (
        <div>
          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className="font-inter text-xs text-blue-600 underline"
          >
            {showSource ? "Hide" : "Show"} retrieved source text (quotes highlighted)
          </button>
          {showSource && (
            <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white/40 p-3 font-inter text-xs text-gray-700 whitespace-pre-wrap">
              {splitWithHighlights(sourceText, allQuotes).map((seg, i) =>
                seg.highlighted ? (
                  <mark key={i} className="bg-yellow-200">{seg.text}</mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SummaryView;
