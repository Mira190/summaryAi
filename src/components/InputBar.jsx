import { useState } from "react";
import { linkIcon } from "../assets";

const InputBar = ({ onSubmit, isLoading }) => {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;
    onSubmit(value.trim());
  };

  return (
    <form className="relative flex justify-center items-center" onSubmit={handleSubmit}>
      <img src={linkIcon} alt="" className="absolute left-0 my-2 ml-3 w-5" />

      <input
        type="text"
        placeholder="Paste a DOI (10.xxxx/...) or an article URL"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
        className="url_input peer"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="submit_btn peer-focus:border-gray-700 peer-focus:text-gray-700 disabled:opacity-50"
      >
        <p>{isLoading ? "…" : "↵"}</p>
      </button>
    </form>
  );
};

export default InputBar;
