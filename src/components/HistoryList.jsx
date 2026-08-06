const HistoryList = ({ items, onSelect }) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
      {items.map((item) => (
        <button
          type="button"
          key={item.key}
          onClick={() => onSelect(item)}
          className="link_card text-left"
        >
          <span className="flex-1 font-satoshi text-blue-700 font-medium text-sm truncate">
            {item.meta.title || item.key}
          </span>
        </button>
      ))}
    </div>
  );
};

export default HistoryList;
