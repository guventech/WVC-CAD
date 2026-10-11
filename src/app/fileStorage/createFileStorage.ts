import { createMemoryFileStorage } from "./memoryFileStorage.ts";
import type { FileStorage } from "./types.ts";
import { createWebFileStorage } from "./webFileStorage.ts";

export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

/**
 * Resolve the platform FileStorage. Playwright / unit tests may inject
 * `window.__WVC_FILE_STORAGE__` before the app mounts.
 */
export async function createFileStorage(): Promise<FileStorage> {
  if (typeof window !== "undefined" && window.__WVC_FILE_STORAGE__ !== undefined) {
    return window.__WVC_FILE_STORAGE__;
  }
  if (isTauriRuntime()) {
    const { createTauriFileStorage } = await import("./tauriFileStorage.ts");
    return createTauriFileStorage();
  }
  return createWebFileStorage();
}

export { createMemoryFileStorage };
