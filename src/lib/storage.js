// localStorage helpers. Everything here (API key included) stays on the user's device --
// nothing is ever sent anywhere except the direct browser->Anthropic call in llm.js.

const KEYS = {
  apiKey: "summaryai.apiKey",
  unpaywallEmail: "summaryai.unpaywallEmail",
  history: "summaryai.history",
};

const HISTORY_LIMIT = 50;

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or unavailable (private browsing) -- fail silently, not fatal
  }
}

function safeParseArray(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const getApiKey = () => safeGet(KEYS.apiKey) ?? "";
export const setApiKey = (key) => safeSet(KEYS.apiKey, key);
export const clearApiKey = () => safeSet(KEYS.apiKey, "");

export const getUnpaywallEmail = () => safeGet(KEYS.unpaywallEmail) ?? "";
export const setUnpaywallEmail = (email) => safeSet(KEYS.unpaywallEmail, email);

export function getHistory() {
  return safeParseArray(safeGet(KEYS.history));
}

export function addHistoryItem(item) {
  const existing = getHistory().filter((entry) => entry.key !== item.key);
  const updated = [item, ...existing].slice(0, HISTORY_LIMIT);
  safeSet(KEYS.history, JSON.stringify(updated));
  return updated;
}

export function clearHistory() {
  safeSet(KEYS.history, JSON.stringify([]));
}
