/** Opaque platform handle for overwrite-on-save (FSA handle or Tauri path). */
export type SketchFileRef = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: "fsa" | "tauri-path" | "memory";
  /** FileSystemFileHandle (web) or absolute path string (Tauri) or memory key. */
  readonly resource: unknown;
};

export type OpenedSketchFile = {
  readonly text: string;
  readonly ref: SketchFileRef;
};

/**
 * Platform file I/O for `.sketch.json`. Lives in `src/app/` — not the sketch domain.
 * Web: File System Access API when available, else download fallback (no durable handle).
 * Tauri: dialog + fs plugins (loaded dynamically).
 */
export interface FileStorage {
  open(): Promise<OpenedSketchFile | null>;
  /** Overwrite `ref` when possible; otherwise behave like saveAs. */
  save(
    text: string,
    ref: SketchFileRef | null,
    suggestedName: string,
  ): Promise<SketchFileRef | null>;
  saveAs(text: string, suggestedName: string): Promise<SketchFileRef | null>;
  /** Re-open a recent entry when the platform still has access. */
  openRef(ref: SketchFileRef): Promise<OpenedSketchFile | null>;
}

export type RecentFileEntry = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: SketchFileRef["kind"];
  readonly openedAt: string;
  /** Tauri absolute path when kind is tauri-path. */
  readonly path?: string;
};
