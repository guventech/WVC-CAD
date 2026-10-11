import { useCallback, useEffect, useMemo, useState } from "react";
import { clearCommandHistory } from "../sketch/commands/Command.ts";
import { getAutosaveInstanceId } from "./autosaveInstanceId.ts";
import { createLocalStorageAutosaveStore } from "./localStorageAutosaveStore.ts";
import { useTauriCloseGuard } from "./useTauriCloseGuard.ts";
import {
  clearAutosaveStore,
  DEFAULT_AUTOSAVE_DEBOUNCE_MS,
  emptySketchCleanFingerprint,
  isSketchDirty,
  readAutosaveStore,
  restoreSketchFromEnvelope,
  shouldOfferRecovery,
  wasWrittenByOtherInstance,
  writeAutosaveStore,
  type AutosaveEnvelope,
} from "../sketch/serialization/SketchAutosave.ts";
import { settleLoadedSketch } from "../sketch/constraints/ConstraintMaintenance.ts";
import type { Sketch } from "../sketch/model/Sketch.ts";
import type { ConstraintConflict } from "../sketch/constraints/OverConstraint.ts";
import {
  clearSelection,
  type SelectionState,
} from "../sketch/selection/SelectionManager.ts";
import type { ActiveTool } from "../sketch/tools/ActiveTool.ts";
import type { DocumentState } from "./useSketchDocument.ts";

export type UseSketchAutosaveOptions = {
  readonly sketch: Sketch;
  readonly documentFileName: string | null;
  readonly setDocumentState: (
    value: DocumentState | ((current: DocumentState) => DocumentState),
  ) => void;
  readonly setDocumentFileName: (name: string | null) => void;
  readonly setSelection: (
    updater: (current: SelectionState) => SelectionState,
  ) => void;
  readonly setActiveTool: (tool: ActiveTool) => void;
  readonly setConstraintMessage: (message: string | null) => void;
  readonly setConstraintConflict: (conflict: ConstraintConflict | null) => void;
};

export function useSketchAutosave({
  sketch,
  documentFileName,
  setDocumentState,
  setDocumentFileName,
  setSelection,
  setActiveTool,
  setConstraintMessage,
  setConstraintConflict,
}: UseSketchAutosaveOptions) {
  const [lastCleanFingerprint, setLastCleanFingerprint] = useState(
    emptySketchCleanFingerprint,
  );
  const [pendingRecovery, setPendingRecovery] =
    useState<AutosaveEnvelope | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [autosaveWarning, setAutosaveWarning] = useState<string | null>(null);
  const [otherInstanceWarning, setOtherInstanceWarning] = useState(false);
  const instanceId = useMemo(() => getAutosaveInstanceId(), []);
  const autosaveStore = useMemo(() => createLocalStorageAutosaveStore(), []);
  const hasUnsavedChanges = useMemo(
    () => isSketchDirty(sketch, lastCleanFingerprint),
    [sketch, lastCleanFingerprint],
  );

  const flushAutosave = useCallback((): void => {
    if (!hasUnsavedChanges) {
      return;
    }
    const result = writeAutosaveStore(autosaveStore, sketch, {
      documentFileName,
      lastCleanFingerprint,
      lastWriterInstanceId: instanceId,
    });
    if (!result.ok) {
      setAutosaveWarning(result.reason);
    }
  }, [
    autosaveStore,
    documentFileName,
    hasUnsavedChanges,
    instanceId,
    lastCleanFingerprint,
    sketch,
  ]);

  useTauriCloseGuard({
    hasUnsavedChanges,
    flushAutosave,
  });

  const handleRestoreRecovery = useCallback(() => {
    if (pendingRecovery === null) {
      return;
    }
    const restored = restoreSketchFromEnvelope(pendingRecovery);
    if (!restored.ok) {
      setConstraintMessage(`Could not restore autosave. ${restored.reason}`);
      clearAutosaveStore(autosaveStore);
      setPendingRecovery(null);
      return;
    }
    setDocumentState({
      sketch: settleLoadedSketch(restored.sketch),
      history: clearCommandHistory(),
    });
    setDocumentFileName(pendingRecovery.documentFileName);
    setLastCleanFingerprint(pendingRecovery.lastCleanFingerprint);
    setSelection((current) => clearSelection(current));
    setActiveTool("select");
    setConstraintMessage(
      otherInstanceWarning
        ? "Restored autosave written by another window. Review before saving."
        : null,
    );
    setConstraintConflict(null);
    setPendingRecovery(null);
    setOtherInstanceWarning(false);
  }, [
    autosaveStore,
    otherInstanceWarning,
    pendingRecovery,
    setActiveTool,
    setConstraintConflict,
    setConstraintMessage,
    setDocumentFileName,
    setDocumentState,
    setSelection,
  ]);

  const handleDiscardRecovery = useCallback(() => {
    clearAutosaveStore(autosaveStore);
    setPendingRecovery(null);
    setOtherInstanceWarning(false);
  }, [autosaveStore]);

  useEffect(() => {
    const result = readAutosaveStore(autosaveStore);
    if (result.ok && shouldOfferRecovery(result.envelope)) {
      setPendingRecovery(result.envelope);
      setOtherInstanceWarning(
        wasWrittenByOtherInstance(result.envelope, instanceId),
      );
    } else if (!result.ok && result.reason !== "No autosave present.") {
      clearAutosaveStore(autosaveStore);
    } else if (result.ok && !shouldOfferRecovery(result.envelope)) {
      clearAutosaveStore(autosaveStore);
    }
    setRecoveryReady(true);
  }, [autosaveStore, instanceId]);

  useEffect(() => {
    if (!recoveryReady || pendingRecovery !== null) {
      return;
    }
    if (!hasUnsavedChanges) {
      clearAutosaveStore(autosaveStore);
      setAutosaveWarning(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const result = writeAutosaveStore(autosaveStore, sketch, {
        documentFileName,
        lastCleanFingerprint,
        lastWriterInstanceId: instanceId,
      });
      if (!result.ok) {
        setAutosaveWarning(result.reason);
      } else {
        setAutosaveWarning(null);
      }
    }, DEFAULT_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    autosaveStore,
    documentFileName,
    hasUnsavedChanges,
    instanceId,
    lastCleanFingerprint,
    pendingRecovery,
    recoveryReady,
    sketch,
  ]);

  useEffect(() => {
    // Tauri/WebView2 close is handled by useTauriCloseGuard; beforeunload
    // confirmations are unreliable there and can interfere with window close.
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!hasUnsavedChanges) {
        return;
      }
      writeAutosaveStore(autosaveStore, sketch, {
        documentFileName,
        lastCleanFingerprint,
        lastWriterInstanceId: instanceId,
      });
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [
    autosaveStore,
    documentFileName,
    hasUnsavedChanges,
    instanceId,
    lastCleanFingerprint,
    sketch,
  ]);

  return {
    autosaveStore,
    lastCleanFingerprint,
    setLastCleanFingerprint,
    hasUnsavedChanges,
    pendingRecovery,
    otherInstanceWarning,
    autosaveWarning,
    handleRestoreRecovery,
    handleDiscardRecovery,
  };
}
