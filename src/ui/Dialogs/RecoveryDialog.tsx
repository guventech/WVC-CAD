import { useEffect, useRef } from "react";

type RecoveryDialogProps = {
  readonly savedAt: string;
  readonly documentLabel: string | null;
  readonly otherInstanceWarning?: boolean;
  readonly onRestore: () => void;
  readonly onDiscard: () => void;
};

export function RecoveryDialog({
  savedAt,
  documentLabel,
  otherInstanceWarning = false,
  onRestore,
  onDiscard,
}: RecoveryDialogProps) {
  const restoreRef = useRef<HTMLButtonElement>(null);
  const when = formatSavedAt(savedAt);

  useEffect(() => {
    restoreRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
        aria-describedby="recovery-body"
        data-testid="recovery-dialog"
      >
        <h2 id="recovery-title">Recover unsaved sketch?</h2>
        <p id="recovery-body">
          A local autosave was found{when !== null ? ` from ${when}` : ""}
          {documentLabel !== null ? ` (${documentLabel})` : ""}. Restoring does
          not overwrite your last saved file — use Save to write changes.
          {otherInstanceWarning
            ? " Warning: this slot was last written by another window."
            : ""}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            data-testid="recovery-discard"
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            ref={restoreRef}
            type="button"
            className="is-active"
            data-testid="recovery-restore"
            onClick={onRestore}
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSavedAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString();
}
