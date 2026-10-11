import { useEffect, useId, useRef, useState } from "react";
import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";
import { renderToolGlyph } from "../icons/toolGlyphs.tsx";

const SHAPE_TOOLS = ["rectangle", "polygon", "slot"] as const;
type ShapeTool = (typeof SHAPE_TOOLS)[number];

const SHAPE_OPTIONS: readonly {
  readonly id: ShapeTool;
  readonly label: string;
  readonly title: string;
}[] = [
  { id: "rectangle", label: "Rectangle", title: "Create rectangles" },
  {
    id: "polygon",
    label: "Polygon",
    title: "Create regular N-gon (center + vertex; [ / ] change sides)",
  },
  {
    id: "slot",
    label: "Slot",
    title: "Create a capsule slot (centers + width)",
  },
];

function isShapeTool(tool: ActiveTool): tool is ShapeTool {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}

type ShapeToolFlyoutProps = {
  readonly activeTool: ActiveTool;
  readonly onToolChange: (tool: ActiveTool) => void;
};

/**
 * Rectangle family control: one toolbar slot; click opens a popup for
 * Rectangle / Polygon / Slot (CAD-style shape flyout).
 */
export function ShapeToolFlyout({
  activeTool,
  onToolChange,
}: ShapeToolFlyoutProps) {
  const [open, setOpen] = useState(false);
  const [lastShape, setLastShape] = useState<ShapeTool>("rectangle");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const familyActive = isShapeTool(activeTool);
  const displayTool = familyActive ? activeTool : lastShape;
  const displayMeta =
    SHAPE_OPTIONS.find((option) => option.id === displayTool) ?? SHAPE_OPTIONS[0]!;

  useEffect(() => {
    if (familyActive) {
      setLastShape(activeTool);
    }
  }, [activeTool, familyActive]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (
        root !== null &&
        event.target instanceof Node &&
        !root.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="tool-flyout" ref={rootRef}>
      <button
        type="button"
        className={
          familyActive || open
            ? "tool-icon-btn tool-flyout-trigger is-active"
            : "tool-icon-btn tool-flyout-trigger"
        }
        aria-label={`${displayMeta.label} shapes`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={`${displayMeta.title} · click for Rectangle / Polygon / Slot`}
        data-testid="tool-shape-flyout"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="tool-icon-glyph" aria-hidden="true">
          {renderToolGlyph(displayTool)}
        </span>
        <span className="tool-flyout-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul
          className="tool-flyout-menu"
          role="menu"
          id={menuId}
          data-testid="tool-shape-flyout-menu"
        >
          {SHAPE_OPTIONS.map((option) => {
            const selected = activeTool === option.id;
            return (
              <li key={option.id} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-label={option.label}
                  aria-checked={selected}
                  className={
                    selected
                      ? "tool-flyout-option is-active"
                      : "tool-flyout-option"
                  }
                  title={option.title}
                  data-testid={`tool-${option.id}`}
                  onClick={() => {
                    setLastShape(option.id);
                    onToolChange(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="tool-icon-glyph" aria-hidden="true">
                    {renderToolGlyph(option.id)}
                  </span>
                  <span className="tool-flyout-option-label">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
