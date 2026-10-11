import type { FileStorage, OpenedSketchFile, SketchFileRef } from "./types.ts";

/**
 * In-memory FileStorage for unit tests and Playwright (injected via
 * `window.__WVC_FILE_STORAGE__`).
 */
export function createMemoryFileStorage(
  seed: ReadonlyMap<string, string> = new Map(),
): FileStorage & {
  readonly files: Map<string, string>;
  readonly lastSavedPath: { current: string | null };
} {
  const files = new Map(seed);
  const lastSavedPath = { current: null as string | null };
  let seq = 0;

  const write = (name: string, text: string): SketchFileRef => {
    files.set(name, text);
    lastSavedPath.current = name;
    return {
      id: `memory:${name}`,
      displayName: name,
      kind: "memory",
      resource: name,
    };
  };

  const read = (name: string): OpenedSketchFile | null => {
    const text = files.get(name);
    if (text === undefined) {
      return null;
    }
    return {
      text,
      ref: {
        id: `memory:${name}`,
        displayName: name,
        kind: "memory",
        resource: name,
      },
    };
  };

  return {
    files,
    lastSavedPath,
    async open(): Promise<OpenedSketchFile | null> {
      const name =
        lastSavedPath.current ??
        [...files.keys()][0] ??
        `untitled-${(seq += 1)}.sketch.json`;
      const existing = read(name);
      if (existing !== null) {
        return existing;
      }
      return null;
    },
    async save(
      text: string,
      ref: SketchFileRef | null,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      if (ref?.kind === "memory" && typeof ref.resource === "string") {
        return write(ref.resource, text);
      }
      return write(suggestedName, text);
    },
    async saveAs(
      text: string,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      return write(suggestedName, text);
    },
    async openRef(ref: SketchFileRef): Promise<OpenedSketchFile | null> {
      if (ref.kind !== "memory" || typeof ref.resource !== "string") {
        return null;
      }
      return read(ref.resource);
    },
  };
}

declare global {
  interface Window {
    __WVC_FILE_STORAGE__?: FileStorage;
  }
}
