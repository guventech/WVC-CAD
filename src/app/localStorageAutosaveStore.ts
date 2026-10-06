import {
  DEFAULT_AUTOSAVE_STORAGE_KEY,
  type AutosaveStore,
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
    write(text) {
      try {
        window.localStorage.setItem(key, text);
      } catch {
        // Quota / private mode — recovery is best-effort.
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
