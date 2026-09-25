import { linkIcon } from "../assets";

const SearchForm = ({ value, onChange, onSubmit, loading }) => {
  const canSubmit = !loading && value.trim() !== "";

  // The form's submit event already covers the Enter key; no keydown handler.
  const handleSubmit = (event) => {
    event.preventDefault();
    if (canSubmit) onSubmit(value);
  };

  return (
    <form className="relative flex justify-center items-center" onSubmit={handleSubmit} role="search">
      <label htmlFor="summary-input" className="sr-only">
        DOI or article URL
      </label>
      <img src={linkIcon} alt="" aria-hidden="true" className="absolute left-0 my-2 ml-3 w-5" />
      <input
        id="summary-input"
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Paste a DOI (10.xxxx/...) or article URL"
        value={value}
        onInput={(event) => onChange(event.currentTarget.value)}
        required
        className="url_input peer"
      />
      <button
        type="submit"
        disabled={!canSubmit}
        aria-label={loading ? "Summarizing…" : "Summarize"}
        className="submit_btn peer-focus:border-gray-700 peer-focus:text-gray-700"
      >
        <span aria-hidden="true">↵</span>
      </button>
    </form>
  );
};

export default SearchForm;
