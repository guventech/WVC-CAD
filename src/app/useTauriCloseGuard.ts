import { useEffect, useRef } from "react";
import { isTauriRuntime } from "./fileStorage/createFileStorage.ts";

type UseTauriCloseGuardOptions = {
  readonly hasUnsavedChanges: boolean;
  readonly flushAutosave: () => void;
};

/**
 * WebView2/Tauri: `beforeunload` is unreliable for blocking close.
 * Flush autosave on close; if dirty, confirm via the native dialog plugin
 * (not `window.confirm`, which often fails in WebView2 and leaves the
 * window stuck after `preventDefault`).
 *
 * Uses refs so the listener is registered once — re-subscribing on every
 * dirty/sketch change previously leaked handlers that permanently blocked close.
 */
export function useTauriCloseGuard({
  hasUnsavedChanges,
  flushAutosave,
}: UseTauriCloseGuardOptions): void {
  const dirtyRef = useRef(hasUnsavedChanges);
  const flushRef = useRef(flushAutosave);
  dirtyRef.current = hasUnsavedChanges;
  flushRef.current = flushAutosave;

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let closing = false;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      if (cancelled) {
        return;
      }
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onCloseRequested(async (event) => {
        if (closing) {
          return;
        }
        flushRef.current();
        if (!dirtyRef.current) {
          return;
        }

        event.preventDefault();
        let proceed = true;
        try {
          const { ask } = await import("@tauri-apps/plugin-dialog");
          proceed = await ask(
            "You have unsaved changes. Close anyway? A local autosave will be kept for recovery.",
            {
              title: "WVC-CAD",
              kind: "warning",
              okLabel: "Close",
              cancelLabel: "Cancel",
            },
          );
        } catch {
          // Dialog plugin unavailable — never trap the user in the window.
          proceed = true;
        }

        if (!proceed) {
          return;
        }

        closing = true;
        try {
          await appWindow.destroy();
        } catch {
          try {
            await appWindow.close();
          } catch {
            closing = false;
          }
        }
      });
      if (cancelled) {
        unlisten();
        unlisten = undefined;
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
