import { ToolIconButton } from "../icons/ToolIconButton.tsx";
import { renderToolGlyph } from "../icons/toolGlyphs.tsx";

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
          <ToolIconButton
            label="New"
            title="New sketch (Ctrl+N)"
            icon={renderToolGlyph("new")}
            onClick={onNew}
            testId="new-button"
          />
        ) : null}
        <ToolIconButton
          label="Open"
          title="Open sketch JSON (Ctrl+O)"
          icon={renderToolGlyph("open")}
          onClick={onOpen}
          testId="open-button"
        />
        <ToolIconButton
          label="Save"
          title="Save sketch JSON (Ctrl+S)"
          icon={renderToolGlyph("save")}
          onClick={onSave}
          testId="save-button"
        />
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
        <ToolIconButton
          label="Undo"
          title={
            undoLabel !== null
              ? `Undo: ${undoLabel} (Ctrl+Z)`
              : "Undo (Ctrl+Z)"
          }
          icon={renderToolGlyph("undo")}
          disabled={!canUndo}
          onClick={onUndo}
          testId="undo-button"
        />
        <ToolIconButton
          label="Redo"
          title={
            redoLabel !== null
              ? `Redo: ${redoLabel} (Ctrl+Y)`
              : "Redo (Ctrl+Y)"
          }
          icon={renderToolGlyph("redo")}
          disabled={!canRedo}
          onClick={onRedo}
          testId="redo-button"
        />
      </div>
    </div>
  );
}
