import { useState } from "react";

const SettingsPanel = ({ apiKey, unpaywallEmail, onSave, onClose }) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [emailInput, setEmailInput] = useState(unpaywallEmail);

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ apiKey: keyInput.trim(), unpaywallEmail: emailInput.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <form
        onSubmit={handleSave}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl flex flex-col gap-4"
      >
        <h3 className="font-satoshi font-bold text-lg text-gray-800">Settings</h3>

        <label className="flex flex-col gap-1 text-sm font-satoshi text-gray-700">
          Anthropic API key
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            className="url_input"
            autoComplete="off"
          />
          <span className="text-xs text-gray-500 font-inter">
            Stored only in this browser&apos;s local storage. Sent directly to
            Anthropic&apos;s API, never to any server we run &mdash; there is no
            server. Get a key at{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              console.anthropic.com
            </a>
            .
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-satoshi text-gray-700">
          Contact email (for Unpaywall &amp; OpenAlex &quot;polite pool&quot;)
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            className="url_input"
          />
          <span className="text-xs text-gray-500 font-inter">
            Required by Unpaywall&apos;s API terms to look up open-access full text
            for a DOI. Not required for plain URL summaries.
          </span>
        </label>

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 py-1.5 px-5 text-sm text-gray-700"
          >
            Cancel
          </button>
          <button type="submit" className="black_btn">
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPanel;
