type FirstRunHintProps = {
  readonly onDismiss: () => void;
};

/** Dismissible empty-canvas tip for first-time users. */
export function FirstRunHint({ onDismiss }: FirstRunHintProps) {
  return (
    <div className="first-run-hint" data-testid="first-run-hint" role="region" aria-label="Getting started">
      <p>
        <strong>Quick start:</strong> Rectangle → constrain → Save. Try{" "}
        <em>File → Open sample…</em> for ready-made sketches.
      </p>
      <button type="button" data-testid="first-run-dismiss" onClick={onDismiss}>
        Got it
      </button>
    </div>
  );
}

export const FIRST_RUN_HINT_STORAGE_KEY = "wvc-cad.first-run-hint.v1";

export function shouldShowFirstRunHint(): boolean {
  try {
    return window.localStorage.getItem(FIRST_RUN_HINT_STORAGE_KEY) !== "dismissed";
  } catch {
    return true;
  }
}

export function dismissFirstRunHint(): void {
  try {
    window.localStorage.setItem(FIRST_RUN_HINT_STORAGE_KEY, "dismissed");
  } catch {
    // ignore
  }
}
