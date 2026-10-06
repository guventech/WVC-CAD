type DocumentBarProps = {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel?: string | null;
  readonly redoLabel?: string | null;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onOpen: () => void;
  readonly onSave: () => void;
  readonly onNew?: () => void;
  readonly documentLabel?: string | null;
  readonly hasUnsavedChanges?: boolean;
};

/**
 * Compact document / history strip under the menu bar.
 * Primary File actions also appear here for one-click access; menus mirror them.
 */
export function DocumentBar({
  canUndo,
  canRedo,
  undoLabel = null,
  redoLabel = null,
  onUndo,
  onRedo,
  onOpen,
  onSave,
  onNew,
  documentLabel = null,
  hasUnsavedChanges = false,
}: DocumentBarProps) {
  const docTitle =
    documentLabel !== null && documentLabel.length > 0
      ? documentLabel
      : "Untitled";

  return (
    <div className="document-bar" aria-label="Document">
      <div className="toolbar-group" role="toolbar" aria-label="File">
        {onNew !== undefined ? (
          <button
            type="button"
            onClick={onNew}
            title="New sketch (Ctrl+N)"
            data-testid="new-button"
          >
            New
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          title="Open sketch JSON (Ctrl+O)"
          data-testid="open-button"
        >
          Open
        </button>
        <button
          type="button"
          onClick={onSave}
          title="Save sketch JSON (Ctrl+S)"
          data-testid="save-button"
        >
          Save
        </button>
      </div>
      <span
        className={hasUnsavedChanges ? "toolbar-doc is-dirty" : "toolbar-doc"}
        title={
          hasUnsavedChanges ? `${docTitle} — unsaved changes` : docTitle
        }
        data-testid="document-label"
      >
        {hasUnsavedChanges ? `${docTitle} *` : docTitle}
      </span>
      <div className="toolbar-spacer" />
      <div className="toolbar-group" role="toolbar" aria-label="History">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          title={
            undoLabel !== null
              ? `Undo: ${undoLabel} (Ctrl+Z)`
              : "Undo (Ctrl+Z)"
          }
          data-testid="undo-button"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          title={
            redoLabel !== null
              ? `Redo: ${redoLabel} (Ctrl+Y)`
              : "Redo (Ctrl+Y)"
          }
          data-testid="redo-button"
        >
          Redo
        </button>
      </div>
    </div>
  );
}
