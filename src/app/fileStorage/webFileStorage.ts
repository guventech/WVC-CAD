import {
  downloadTextFile,
  pickSketchFileText,
  sketchDownloadFileName,
} from "../sketchFileIo.ts";
import { getFsaHandle, putFsaHandle } from "./fsaHandleStore.ts";
import type { FileStorage, OpenedSketchFile, SketchFileRef } from "./types.ts";

const SKETCH_PICKER_TYPES = [
  {
    description: "WVC-CAD sketch",
    accept: {
      "application/json": [".sketch.json", ".json"],
    },
  },
] as const;

function supportsFileSystemAccess(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showOpenFilePicker === "function" &&
    typeof window.showSaveFilePicker === "function"
  );
}

function openFilePicker(
  options: OpenFilePickerOptions,
): Promise<FileSystemFileHandle[]> {
  const picker = window.showOpenFilePicker;
  if (picker === undefined) {
    return Promise.reject(new Error("showOpenFilePicker unavailable"));
  }
  return picker(options);
}

function saveFilePicker(
  options: SaveFilePickerOptions,
): Promise<FileSystemFileHandle> {
  const picker = window.showSaveFilePicker;
  if (picker === undefined) {
    return Promise.reject(new Error("showSaveFilePicker unavailable"));
  }
  return picker(options);
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fsa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function writeFsaHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function refFromFsaHandle(
  handle: FileSystemFileHandle,
  existingId?: string,
): Promise<SketchFileRef> {
  const id = existingId ?? newId();
  await putFsaHandle(id, handle);
  return {
    id,
    displayName: handle.name,
    kind: "fsa",
    resource: handle,
  };
}

function isFileSystemFileHandle(value: unknown): value is FileSystemFileHandle {
  return (
    typeof FileSystemFileHandle !== "undefined" &&
    value instanceof FileSystemFileHandle
  );
}

type FsaPermissionHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
};

async function ensureFsaReadPermission(
  handle: FileSystemFileHandle,
): Promise<boolean> {
  const withPerm = handle as FsaPermissionHandle;
  try {
    if (typeof withPerm.queryPermission !== "function") {
      return true;
    }
    const permission = await withPerm.queryPermission({ mode: "read" });
    if (permission === "granted") {
      return true;
    }
    if (typeof withPerm.requestPermission !== "function") {
      return true;
    }
    return (await withPerm.requestPermission({ mode: "read" })) === "granted";
  } catch {
    return true;
  }
}

export function createWebFileStorage(): FileStorage {
  if (!supportsFileSystemAccess()) {
    return createDownloadOnlyFileStorage();
  }

  const storage: FileStorage = {
    async open(): Promise<OpenedSketchFile | null> {
      try {
        const [handle] = await openFilePicker({
          multiple: false,
          types: [...SKETCH_PICKER_TYPES],
        });
        const file = await handle.getFile();
        const text = await file.text();
        const ref = await refFromFsaHandle(handle);
        return { text, ref };
      } catch (error) {
        if (isAbortError(error)) {
          return null;
        }
        throw error;
      }
    },

    async save(
      text: string,
      ref: SketchFileRef | null,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      if (ref?.kind === "fsa") {
        const handle = isFileSystemFileHandle(ref.resource)
          ? ref.resource
          : await getFsaHandle(ref.id);
        if (handle !== null) {
          await writeFsaHandle(handle, text);
          return refFromFsaHandle(handle, ref.id);
        }
      }
      return storage.saveAs(text, suggestedName);
    },

    async saveAs(
      text: string,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      try {
        const handle = await saveFilePicker({
          suggestedName: sketchDownloadFileName(
            suggestedName.replace(/\.sketch\.json$/i, ""),
          ),
          types: [...SKETCH_PICKER_TYPES],
        });
        await writeFsaHandle(handle, text);
        return refFromFsaHandle(handle);
      } catch (error) {
        if (isAbortError(error)) {
          return null;
        }
        throw error;
      }
    },

    async openRef(ref: SketchFileRef): Promise<OpenedSketchFile | null> {
      if (ref.kind !== "fsa") {
        return null;
      }
      const handle = isFileSystemFileHandle(ref.resource)
        ? ref.resource
        : await getFsaHandle(ref.id);
      if (handle === null) {
        return null;
      }
      if (!(await ensureFsaReadPermission(handle))) {
        return null;
      }
      const file = await handle.getFile();
      return {
        text: await file.text(),
        ref: await refFromFsaHandle(handle, ref.id),
      };
    },
  };
  return storage;
}

function createDownloadOnlyFileStorage(): FileStorage {
  const storage: FileStorage = {
    async open(): Promise<OpenedSketchFile | null> {
      // Legacy <input type="file"> path — no durable handle for overwrite.
      const text = await pickSketchFileText();
      if (text === null) {
        return null;
      }
      return {
        text,
        ref: {
          id: newId(),
          displayName: "sketch.sketch.json",
          kind: "fsa",
          resource: null,
        },
      };
    },
    async save(
      text: string,
      _ref: SketchFileRef | null,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      return storage.saveAs(text, suggestedName);
    },
    async saveAs(
      text: string,
      suggestedName: string,
    ): Promise<SketchFileRef | null> {
      const name = sketchDownloadFileName(
        suggestedName.replace(/\.sketch\.json$/i, ""),
      );
      downloadTextFile(name, text);
      return {
        id: newId(),
        displayName: name,
        kind: "fsa",
        resource: null,
      };
    },
    async openRef(): Promise<OpenedSketchFile | null> {
      return null;
    },
  };
  return storage;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "NotAllowedError")
  );
}
