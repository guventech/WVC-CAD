import { useCallback, useEffect, useState } from "react";
import { clearCommandHistory } from "../sketch/commands/Command.ts";
import {
  downloadTextFile,
  sketchDownloadFileName,
} from "./sketchFileIo.ts";
import {
  createFileStorage,
  isTauriRuntime,
} from "./fileStorage/createFileStorage.ts";
import { createWebFileStorage } from "./fileStorage/webFileStorage.ts";
import {
  createLocalStorageRecentStore,
  loadRecentFiles,
  recentEntryToFileRef,
  rememberRecentFile,
} from "./fileStorage/recentFiles.ts";
import type { RecentFileEntry, SketchFileRef } from "./fileStorage/types.ts";
import type { FileStorage } from "./fileStorage/types.ts";
import {
  clearAutosaveStore,
  sketchContentFingerprint,
  type AutosaveStore,
} from "../sketch/serialization/SketchAutosave.ts";
import { settleLoadedSketch } from "../sketch/constraints/ConstraintMaintenance.ts";
import {
  dxfDownloadFileName,
  tryExportSketchToDxf,
} from "../sketch/serialization/DxfExporter.ts";
import {
  parseSketchJson,
  serializeSketchToJson,
} from "../sketch/serialization/SketchSerializer.ts";
import type { Sketch } from "../sketch/model/Sketch.ts";
import {
  clearSelection,
  type SelectionState,
} from "../sketch/selection/SelectionManager.ts";
import type { ActiveTool } from "../sketch/tools/ActiveTool.ts";
import type { ConstraintConflict } from "../sketch/constraints/OverConstraint.ts";
import type { DocumentState } from "./useSketchDocument.ts";
import { SAMPLE_SKETCHES } from "./sampleSketches.ts";

export type UseSketchFileIoOptions = {
  readonly sketch: Sketch;
  readonly documentFileName: string | null;
  readonly hasUnsavedChanges: boolean;
  readonly setDocumentFileName: (name: string | null) => void;
  readonly setDocumentState: (
    value: DocumentState | ((current: DocumentState) => DocumentState),
  ) => void;
  readonly setLastCleanFingerprint: (fingerprint: string) => void;
  readonly autosaveStore: AutosaveStore;
  readonly setSelection: (
    updater: (current: SelectionState) => SelectionState,
  ) => void;
  readonly setActiveTool: (tool: ActiveTool) => void;
  readonly setConstraintMessage: (
    message: string | null,
    tone?: "error" | "info",
  ) => void;
  readonly setConstraintConflict: (conflict: ConstraintConflict | null) => void;
};

/** Shared dirty-document gate for New / Open / Sample / Recent. */
export function confirmDiscardUnsavedChanges(hasUnsavedChanges: boolean): boolean {
  if (!hasUnsavedChanges) {
    return true;
  }
  return window.confirm("Discard unsaved changes and open another sketch?");
}

function isFileSystemFileHandle(value: unknown): value is FileSystemFileHandle {
  return (
    typeof FileSystemFileHandle !== "undefined" &&
    value instanceof FileSystemFileHandle
  );
}

function isReopenableRef(ref: SketchFileRef): boolean {
  if (ref.kind === "tauri-path" || ref.kind === "memory") {
    return true;
  }
  if (ref.kind === "fsa") {
    return (
      isFileSystemFileHandle(ref.resource) ||
      (typeof ref.resource === "string" && ref.resource.length > 0)
    );
  }
  return false;
}

export function useSketchFileIo({
  sketch,
  documentFileName,
  hasUnsavedChanges,
  setDocumentFileName,
  setDocumentState,
  setLastCleanFingerprint,
  autosaveStore,
  setSelection,
  setActiveTool,
  setConstraintMessage,
  setConstraintConflict,
}: UseSketchFileIoOptions) {
  const [storage, setStorage] = useState<FileStorage | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    if (window.__WVC_FILE_STORAGE__ !== undefined) {
      return window.__WVC_FILE_STORAGE__;
    }
    // Web storage is synchronous; Tauri plugins load async.
    if (!isTauriRuntime()) {
      return createWebFileStorage();
    }
    return null;
  });
  const [fileRef, setFileRef] = useState<SketchFileRef | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(() =>
    loadRecentFiles(),
  );

  useEffect(() => {
    if (storage !== null) {
      return;
    }
    let cancelled = false;
    void createFileStorage().then((resolved) => {
      if (!cancelled) {
        setStorage(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const applyOpenedSketch = useCallback(
    (text: string, ref: SketchFileRef | null) => {
      const parsed = parseSketchJson(text);
      if (!parsed.ok) {
        setConstraintMessage(`Could not open sketch. ${parsed.reason}`);
        setConstraintConflict(null);
        return false;
      }
      const loaded = settleLoadedSketch(parsed.sketch);
      setDocumentState({
        sketch: loaded,
        history: clearCommandHistory(),
      });
      const name = ref?.displayName ?? sketchDownloadFileName(loaded.name);
      setDocumentFileName(name);
      setFileRef(ref);
      setLastCleanFingerprint(sketchContentFingerprint(loaded));
      clearAutosaveStore(autosaveStore);
      setSelection((current) => clearSelection(current));
      setConstraintMessage(null);
      setConstraintConflict(null);
      setActiveTool("select");
      if (ref !== null && isReopenableRef(ref)) {
        setRecentFiles(rememberRecentFile(ref));
      }
      return true;
    },
    [
      autosaveStore,
      setActiveTool,
      setConstraintConflict,
      setConstraintMessage,
      setDocumentFileName,
      setDocumentState,
      setLastCleanFingerprint,
      setSelection,
    ],
  );

  const markSaved = useCallback(
    (ref: SketchFileRef) => {
      setFileRef(ref);
      setDocumentFileName(ref.displayName);
      setLastCleanFingerprint(sketchContentFingerprint(sketch));
      clearAutosaveStore(autosaveStore);
      setConstraintMessage(null);
      setConstraintConflict(null);
      if (isReopenableRef(ref)) {
        setRecentFiles(rememberRecentFile(ref));
      }
    },
    [
      autosaveStore,
      setConstraintConflict,
      setConstraintMessage,
      setDocumentFileName,
      setLastCleanFingerprint,
      sketch,
    ],
  );

  const handleSave = useCallback(() => {
    if (storage === null) {
      return;
    }
    const suggested =
      documentFileName ?? sketchDownloadFileName(sketch.name);
    const json = serializeSketchToJson(sketch);
    void storage
      .save(json, fileRef, suggested)
      .then((ref) => {
        if (ref === null) {
          return;
        }
        markSaved(ref);
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown error";
        setConstraintMessage(`Could not save sketch. ${detail}`);
        setConstraintConflict(null);
      });
  }, [
    documentFileName,
    fileRef,
    markSaved,
    setConstraintConflict,
    setConstraintMessage,
    sketch,
    storage,
  ]);

  const handleSaveAs = useCallback(() => {
    if (storage === null) {
      return;
    }
    const suggested =
      documentFileName ?? sketchDownloadFileName(sketch.name);
    const json = serializeSketchToJson(sketch);
    void storage
      .saveAs(json, suggested)
      .then((ref) => {
        if (ref === null) {
          return;
        }
        markSaved(ref);
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown error";
        setConstraintMessage(`Could not save sketch. ${detail}`);
        setConstraintConflict(null);
      });
  }, [
    documentFileName,
    markSaved,
    setConstraintConflict,
    setConstraintMessage,
    sketch,
    storage,
  ]);

  const handleExportDxf = useCallback(() => {
    const outcome = tryExportSketchToDxf(sketch);
    if (!outcome.ok) {
      setConstraintMessage(`Could not export DXF. ${outcome.reason}`);
      setConstraintConflict(null);
      return;
    }
    const filename = dxfDownloadFileName(
      documentFileName?.replace(/\.sketch\.json$/i, "") ?? sketch.name,
    );
    downloadTextFile(filename, outcome.dxf);
    setConstraintMessage(
      "Exported geometry-only DXF. Constraints remain in .sketch.json (import not supported).",
      "info",
    );
    setConstraintConflict(null);
  }, [documentFileName, setConstraintConflict, setConstraintMessage, sketch]);

  const handleOpen = useCallback(() => {
    if (storage === null) {
      return;
    }
    if (!confirmDiscardUnsavedChanges(hasUnsavedChanges)) {
      return;
    }
    void storage.open().then((opened) => {
      if (opened === null) {
        return;
      }
      applyOpenedSketch(opened.text, opened.ref);
    });
  }, [applyOpenedSketch, hasUnsavedChanges, storage]);

  const handleOpenSample = useCallback(
    (sampleId: string) => {
      const sample = SAMPLE_SKETCHES.find((item) => item.id === sampleId);
      if (sample === undefined) {
        setConstraintMessage("Sample sketch not found.");
        return;
      }
      if (!confirmDiscardUnsavedChanges(hasUnsavedChanges)) {
        return;
      }
      void fetch(sample.path)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          // Not a durable file handle — do not add to Open recent.
          applyOpenedSketch(text, {
            id: `sample:${sample.id}`,
            displayName: `${sample.label}.sketch.json`,
            kind: "fsa",
            resource: null,
          });
        })
        .catch(() => {
          setConstraintMessage(`Could not open sample “${sample.label}”.`);
        });
    },
    [applyOpenedSketch, hasUnsavedChanges, setConstraintMessage],
  );

  const handleOpenRecent = useCallback(
    (entryId: string) => {
      if (storage === null) {
        return;
      }
      if (!confirmDiscardUnsavedChanges(hasUnsavedChanges)) {
        return;
      }
      const entry = loadRecentFiles(createLocalStorageRecentStore()).find(
        (item) => item.id === entryId,
      );
      if (entry === undefined) {
        setConstraintMessage("Recent file is no longer available.");
        return;
      }
      const ref = recentEntryToFileRef(entry);
      if (ref === null) {
        setConstraintMessage("Recent file is no longer available.");
        return;
      }
      void storage.openRef(ref).then((opened) => {
        if (opened === null) {
          setConstraintMessage(
            "Could not reopen recent file. Use File → Open…",
          );
          return;
        }
        applyOpenedSketch(opened.text, opened.ref);
      });
    },
    [applyOpenedSketch, hasUnsavedChanges, setConstraintMessage, storage],
  );

  const clearDocumentFile = useCallback(() => {
    setFileRef(null);
  }, []);

  return {
    handleSave,
    handleSaveAs,
    handleOpen,
    handleOpenRecent,
    handleOpenSample,
    handleExportDxf,
    recentFiles,
    clearDocumentFile,
  };
}
