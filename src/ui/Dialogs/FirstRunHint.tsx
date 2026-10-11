type FirstRunHintProps = {
  readonly onDismiss: () => void;
};

/** Dismissible empty-canvas tip for first-time users. */
export function FirstRunHint({ onDismiss }: FirstRunHintProps) {
  return (
    <div
      className="first-run-hint"
      data-testid="first-run-hint"
      role="region"
      aria-label="Getting started"
    >
      <p>
        <strong>Quick start:</strong> draw a <em>Rectangle</em> (shape ▾), add{" "}
        <em>Distance</em> / <em>Size</em>, check Sketch Analysis, then{" "}
        <em>File → Save</em>. <em>Escape</em> cancels tools and in-progress drags.
        Or open <em>File → Sample: …</em> for a ready sketch.
      </p>
      <button
        type="button"
        data-testid="first-run-dismiss"
        aria-label="Dismiss getting started tip"
        onClick={onDismiss}
      >
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
