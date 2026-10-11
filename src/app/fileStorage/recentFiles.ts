import type { RecentFileEntry, SketchFileRef } from "./types.ts";

export const RECENT_FILES_STORAGE_KEY = "wvc-cad.recent.v1";
const MAX_RECENT = 8;

export type RecentFilesStore = {
  readonly read: () => string | null;
  readonly write: (value: string) => void;
};

export function createLocalStorageRecentStore(
  key: string = RECENT_FILES_STORAGE_KEY,
): RecentFilesStore {
  return {
    read: () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write: (value: string) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Quota / private mode — recent list is best-effort.
      }
    },
  };
}

export function loadRecentFiles(
  store: RecentFilesStore = createLocalStorageRecentStore(),
): RecentFileEntry[] {
  const raw = store.read();
  if (raw === null || raw.length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(isRecentFileEntry)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberRecentFile(
  ref: SketchFileRef,
  store: RecentFilesStore = createLocalStorageRecentStore(),
  now: string = new Date().toISOString(),
): RecentFileEntry[] {
  const entry: RecentFileEntry = {
    id: ref.id,
    displayName: ref.displayName,
    kind: ref.kind,
    openedAt: now,
    path: ref.kind === "tauri-path" ? String(ref.resource) : undefined,
  };
  const previous = loadRecentFiles(store).filter((item) => item.id !== entry.id);
  const next = [entry, ...previous].slice(0, MAX_RECENT);
  store.write(JSON.stringify(next));
  return next;
}

export function recentEntryToFileRef(
  entry: RecentFileEntry,
): SketchFileRef | null {
  if (entry.kind === "tauri-path") {
    if (entry.path === undefined || entry.path.length === 0) {
      return null;
    }
    return {
      id: entry.id,
      displayName: entry.displayName,
      kind: "tauri-path",
      resource: entry.path,
    };
  }
  if (entry.kind === "fsa" || entry.kind === "memory") {
    return {
      id: entry.id,
      displayName: entry.displayName,
      kind: entry.kind,
      resource: entry.id,
    };
  }
  return null;
}

function isRecentFileEntry(value: unknown): value is RecentFileEntry {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.displayName === "string" &&
    (row.kind === "fsa" || row.kind === "tauri-path" || row.kind === "memory") &&
    typeof row.openedAt === "string"
  );
}
