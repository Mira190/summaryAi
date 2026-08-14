import { useEffect, useRef, useState } from "react";

const FOCUSABLE_SELECTOR =
  'input, button, a[href], [tabindex]:not([tabindex="-1"])';

const SettingsPanel = ({ apiKey, unpaywallEmail, onSave, onClose }) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [emailInput, setEmailInput] = useState(unpaywallEmail);
  const formRef = useRef(null);

  useEffect(() => {
    const firstInput = formRef.current?.querySelector("input");
    firstInput?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !formRef.current) return;

      const focusable = Array.from(formRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ apiKey: keyInput.trim(), unpaywallEmail: emailInput.trim() });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <form
        ref={formRef}
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl flex flex-col gap-4"
      >
        <h3 id="settings-title" className="font-satoshi font-bold text-lg text-gray-800">
          Settings
        </h3>

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
