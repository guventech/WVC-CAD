import type { FileStorage, OpenedSketchFile, SketchFileRef } from "./types.ts";

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function refFromPath(path: string): SketchFileRef {
  return {
    id: `tauri:${path}`,
    displayName: basename(path),
    kind: "tauri-path",
    resource: path,
  };
}

/**
 * Tauri dialog + fs implementation. Imported only when running inside Tauri
 * so the web bundle does not load the plugins on first paint.
 */
export async function createTauriFileStorage(): Promise<FileStorage> {
  const dialog = await import("@tauri-apps/plugin-dialog");
  const fs = await import("@tauri-apps/plugin-fs");

  const storage: FileStorage = {
    async open(): Promise<OpenedSketchFile | null> {
      const selected = await dialog.open({
        multiple: false,
        filters: [
          { name: "WVC-CAD sketch", extensions: ["json"] },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (selected === null || Array.isArray(selected)) {
        return null;
      }
      const text = await fs.readTextFile(selected);
      return { text, ref: refFromPath(selected) };
    },

    async save(
      text: string,
      ref: SketchFileRef | null,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      if (ref?.kind === "tauri-path" && typeof ref.resource === "string") {
        await fs.writeTextFile(ref.resource, text);
        return refFromPath(ref.resource);
      }
      return storage.saveAs(text, suggestedName);
    },

    async saveAs(
      text: string,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      const path = await dialog.save({
        defaultPath: suggestedName.endsWith(".sketch.json")
          ? suggestedName
          : `${suggestedName}.sketch.json`,
        filters: [{ name: "WVC-CAD sketch", extensions: ["json"] }],
      });
      if (path === null) {
        return null;
      }
      await fs.writeTextFile(path, text);
      return refFromPath(path);
    },

    async openRef(ref: SketchFileRef): Promise<OpenedSketchFile | null> {
      if (ref.kind !== "tauri-path" || typeof ref.resource !== "string") {
        return null;
      }
      const text = await fs.readTextFile(ref.resource);
      return { text, ref: refFromPath(ref.resource) };
    },
  };
  return storage;
}
