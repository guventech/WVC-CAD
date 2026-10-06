import { useEffect, useRef, useState } from "react";

type DimensionCanvasEditorProps = {
  readonly left: number;
  readonly top: number;
  readonly initial: string;
  readonly unitLabel: string;
  readonly ariaLabel: string;
  readonly onCommit: (text: string) => void;
  readonly onCancel: () => void;
};

/** Floating edit field over a canvas dimension label. */
export function DimensionCanvasEditor({
  left,
  top,
  initial,
  unitLabel,
  ariaLabel,
  onCommit,
  onCancel,
}: DimensionCanvasEditorProps) {
  const [text, setText] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className="dimension-canvas-editor"
      style={{ left, top }}
      data-testid="dimension-canvas-editor"
    >
      <input
        ref={inputRef}
        className="dimension-input"
        type="text"
        inputMode="decimal"
        value={text}
        aria-label={ariaLabel}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onCommit(text)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(text);
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <span>{unitLabel}</span>
    </div>
  );
}
