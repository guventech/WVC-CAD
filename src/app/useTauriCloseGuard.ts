import { useEffect } from "react";
import { isTauriRuntime } from "./fileStorage/createFileStorage.ts";

type UseTauriCloseGuardOptions = {
  readonly hasUnsavedChanges: boolean;
  readonly flushAutosave: () => void;
};

/**
 * WebView2/Tauri: `beforeunload` is unreliable for blocking close.
 * Flush autosave and confirm when the window close is requested.
 */
export function useTauriCloseGuard({
  hasUnsavedChanges,
  flushAutosave,
}: UseTauriCloseGuardOptions): void {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      if (disposed) {
        return;
      }
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onCloseRequested(async (event) => {
        if (!hasUnsavedChanges) {
          return;
        }
        event.preventDefault();
        flushAutosave();
        const proceed = window.confirm(
          "You have unsaved changes. Close anyway? A local autosave will be kept for recovery.",
        );
        if (proceed) {
          await appWindow.destroy();
        }
      });
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [flushAutosave, hasUnsavedChanges]);
}
