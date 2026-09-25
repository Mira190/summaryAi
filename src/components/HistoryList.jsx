import { useEffect, useRef, useState } from "preact/hooks";

import { copy, tick } from "../assets";
import { toDoiUrl } from "../utils/doi";

const COPIED_MS = 3000;

const labelFor = (item) => item.title || (item.doi ? `doi:${item.doi}` : item.url);
const linkFor = (item) => (item.doi ? toDoiUrl(item.doi) : item.url);

const HistoryList = ({ items, activeId, onSelect, onDelete }) => {
  const [copiedId, setCopiedId] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (items.length === 0) return null;

  const handleCopy = async (event, item) => {
    event.stopPropagation();
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (typeof clipboard?.writeText !== "function") return;
    try {
      await clipboard.writeText(linkFor(item));
    } catch {
      // Permission denied or insecure context: leave the icon unchanged.
      return;
    }
    setCopiedId(item.id);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedId(null), COPIED_MS);
  };

  const handleDelete = (event, item) => {
    event.stopPropagation();
    onDelete(item.id);
  };

  return (
    <ul aria-label="Recent summaries" className="flex flex-col gap-1 max-h-60 overflow-y-auto">
      {items.map((item) => {
        const label = labelFor(item);
        const copied = copiedId === item.id;
        const active = item.id === activeId;
        return (
          <li key={item.id} className={`link_card ${active ? "border-blue-500" : ""}`}>
            <button
              type="button"
              className="copy_btn"
              onClick={(event) => handleCopy(event, item)}
              aria-label={copied ? "Link copied" : `Copy link for ${label}`}
            >
              <img src={copied ? tick : copy} alt="" className="w-[40%] h-[40%] object-contain" />
            </button>
            <button
              type="button"
              className="flex-1 min-w-0 text-left"
              onClick={() => onSelect(item)}
              aria-current={active ? "true" : undefined}
              title={label}
            >
              <span className="block truncate font-satoshi text-blue-700 font-medium text-sm">
                {label}
              </span>
              {item.title && (
                <span className="block truncate font-satoshi text-gray-500 text-xs">
                  {item.doi ? `doi:${item.doi}` : item.url}
                </span>
              )}
            </button>
            <button
              type="button"
              className="delete_btn"
              onClick={(event) => handleDelete(event, item)}
              aria-label={`Delete ${label} from history`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default HistoryList;
