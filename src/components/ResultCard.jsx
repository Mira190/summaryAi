import { toDoiUrl } from "../utils/doi";
import { parseHttpUrl } from "../utils/input";

const MAX_AUTHORS = 6;

const formatAuthors = (authors) =>
  authors.length > MAX_AUTHORS
    ? `${authors.slice(0, MAX_AUTHORS).join(", ")}, et al.`
    : authors.join(", ");

const ResultCard = ({ result }) => {
  const { title, authors = [], journal, year, doi, url, summary, source, notice } = result;
  const link = doi ? toDoiUrl(doi) : parseHttpUrl(url ?? "");
  const venue = [journal, year].filter(Boolean).join(" · ");
  const hasMeta = Boolean(title || authors.length || venue || doi);

  return (
    <article className="flex flex-col gap-3 w-full">
      <h2 className="font-satoshi font-bold text-gray-600 text-xl">
        Article <span className="blue_gradient">Summary</span>
      </h2>

      {hasMeta && (
        <div className="summary_box flex flex-col gap-1">
          {title && <h3 className="font-satoshi font-bold text-white text-lg leading-snug">{title}</h3>}
          {authors.length > 0 && (
            <p className="font-inter text-sm text-gray-100">{formatAuthors(authors)}</p>
          )}
          {venue && <p className="font-inter text-sm text-gray-200 italic">{venue}</p>}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-inter text-sm text-blue-100 underline break-all"
            >
              {doi ? `doi:${doi}` : link}
            </a>
          )}
        </div>
      )}

      {summary && (
        <div className="summary_box flex flex-col gap-2">
          {source === "abstract" && (
            <p className="source_badge">Publisher abstract via Crossref</p>
          )}
          <p className="font-inter font-medium text-sm text-gray-100 whitespace-pre-line">{summary}</p>
          {notice && <p className="font-inter text-xs text-gray-200">{notice}</p>}
        </div>
      )}
    </article>
  );
};

export default ResultCard;
