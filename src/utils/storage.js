// JSON localStorage helpers that never throw (private mode, quota, corrupt data).

function getStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function safeGet(key, fallback = null) {
  try {
    const raw = getStorage()?.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function safeSet(key, value) {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key) {
  try {
    getStorage()?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
