import {
  SKETCH_FILE_ACCEPT,
  SKETCH_FILE_EXTENSION,
} from "../sketch/serialization/SketchSchema.ts";

/** Suggest a download name from the sketch name. */
export function sketchDownloadFileName(sketchName: string): string {
  const base = sketchName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const stem = (base.length > 0 ? base : "sketch").toLowerCase();
  return stem.endsWith(".sketch.json")
    ? stem
    : `${stem}${SKETCH_FILE_EXTENSION}`;
}

/** Trigger a browser download of JSON text. */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Open a native file picker for `.sketch.json` / JSON and return file text.
 * Resolves null when the user cancels.
 */
export function pickSketchFileText(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = SKETCH_FILE_ACCEPT;
    input.style.display = "none";

    let settled = false;
    const finish = (value: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file === undefined) {
        finish(null);
        return;
      }
      void file.text().then(
        (text) => finish(text),
        () => finish(null),
      );
    });

    // Some browsers fire `cancel` when the dialog is dismissed.
    input.addEventListener("cancel", () => finish(null));

    document.body.appendChild(input);
    input.click();
  });
}
