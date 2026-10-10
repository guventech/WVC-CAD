import { useCallback } from "react";
import { clearCommandHistory } from "../sketch/commands/Command.ts";
import {
  downloadTextFile,
  pickSketchFileText,
  sketchDownloadFileName,
} from "./sketchFileIo.ts";
import {
  clearAutosaveStore,
  sketchContentFingerprint,
  type AutosaveStore,
} from "../sketch/serialization/SketchAutosave.ts";
import { settleLoadedSketch } from "../sketch/constraints/ConstraintMaintenance.ts";
import {
  dxfDownloadFileName,
  exportSketchToDxf,
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

export type UseSketchFileIoOptions = {
  readonly sketch: Sketch;
  readonly documentFileName: string | null;
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
  readonly setConstraintMessage: (message: string | null) => void;
  readonly setConstraintConflict: (conflict: ConstraintConflict | null) => void;
};

export function useSketchFileIo({
  sketch,
  documentFileName,
  setDocumentFileName,
  setDocumentState,
  setLastCleanFingerprint,
  autosaveStore,
  setSelection,
  setActiveTool,
  setConstraintMessage,
  setConstraintConflict,
}: UseSketchFileIoOptions) {
  const handleSave = useCallback(() => {
    const filename =
      documentFileName ?? sketchDownloadFileName(sketch.name);
    const json = serializeSketchToJson(sketch);
    downloadTextFile(filename, json);
    setDocumentFileName(filename);
    setLastCleanFingerprint(sketchContentFingerprint(sketch));
    clearAutosaveStore(autosaveStore);
    setConstraintMessage(null);
    setConstraintConflict(null);
  }, [
    autosaveStore,
    documentFileName,
    setConstraintConflict,
    setConstraintMessage,
    setDocumentFileName,
    setLastCleanFingerprint,
    sketch,
  ]);

  const handleExportDxf = useCallback(() => {
    const filename = dxfDownloadFileName(
      documentFileName?.replace(/\.sketch\.json$/i, "") ?? sketch.name,
    );
    downloadTextFile(filename, exportSketchToDxf(sketch));
    setConstraintMessage(null);
    setConstraintConflict(null);
  }, [documentFileName, setConstraintConflict, setConstraintMessage, sketch]);

  const handleOpen = useCallback(() => {
    void pickSketchFileText().then((text) => {
      if (text === null) {
        return;
      }
      const parsed = parseSketchJson(text);
      if (!parsed.ok) {
        setConstraintMessage(`Could not open sketch. ${parsed.reason}`);
        setConstraintConflict(null);
        return;
      }
      const sketch = settleLoadedSketch(parsed.sketch);
      setDocumentState({
        sketch,
        history: clearCommandHistory(),
      });
      setDocumentFileName(sketchDownloadFileName(sketch.name));
      setLastCleanFingerprint(sketchContentFingerprint(sketch));
      clearAutosaveStore(autosaveStore);
      setSelection((current) => clearSelection(current));
      setConstraintMessage(null);
      setConstraintConflict(null);
      setActiveTool("select");
    });
  }, [
    autosaveStore,
    setActiveTool,
    setConstraintConflict,
    setConstraintMessage,
    setDocumentFileName,
    setDocumentState,
    setLastCleanFingerprint,
    setSelection,
  ]);

  return {
    handleSave,
    handleOpen,
    handleExportDxf,
  };
}
