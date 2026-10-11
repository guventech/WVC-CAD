import {
  DEFAULT_AUTOSAVE_STORAGE_KEY,
  type AutosaveStore,
  type AutosaveWriteResult,
} from "../sketch/serialization/SketchAutosave.ts";

/** Browser localStorage adapter for the recovery autosave slot. */
export function createLocalStorageAutosaveStore(
  key: string = DEFAULT_AUTOSAVE_STORAGE_KEY,
): AutosaveStore {
  return {
    read() {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(text): AutosaveWriteResult {
      try {
        window.localStorage.setItem(key, text);
        return { ok: true };
      } catch (error) {
        if (isQuotaExceeded(error)) {
          return {
            ok: false,
            reason: "Autosave storage is full (quota exceeded).",
          };
        }
        return {
          ok: false,
          reason: "Autosave storage is unavailable.",
        };
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22
    );
  }
  return false;
}
