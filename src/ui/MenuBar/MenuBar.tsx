import { useEffect, useId, useRef, useState } from "react";
import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";

export type MenuActionId =
  | "file-new"
  | "file-open"
  | "file-save"
  | "edit-undo"
  | "edit-redo"
  | "edit-delete"
  | "edit-toggle-construction"
  | "edit-construction-mode"
  | `tool:${ActiveTool}`;

type MenuItem =
  | {
      readonly kind: "action";
      readonly id: MenuActionId;
      readonly label: string;
      readonly shortcut?: string;
      readonly disabled?: boolean;
    }
  | { readonly kind: "separator" };

type MenuDefinition = {
  readonly id: string;
  readonly label: string;
  readonly items: readonly MenuItem[];
};

type MenuBarProps = {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canDelete: boolean;
  readonly canToggleConstruction: boolean;
  readonly createAsConstruction: boolean;
  readonly activeTool: ActiveTool;
  readonly onAction: (action: MenuActionId) => void;
};

export function MenuBar({
  canUndo,
  canRedo,
  canDelete,
  canToggleConstruction,
  createAsConstruction,
  activeTool,
  onAction,
}: MenuBarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const baseId = useId();

  const menus: readonly MenuDefinition[] = [
    {
      id: "file",
      label: "File",
      items: [
        { kind: "action", id: "file-new", label: "New sketch", shortcut: "Ctrl+N" },
        { kind: "action", id: "file-open", label: "Open…", shortcut: "Ctrl+O" },
        { kind: "action", id: "file-save", label: "Save…", shortcut: "Ctrl+S" },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        {
          kind: "action",
          id: "edit-undo",
          label: "Undo",
          shortcut: "Ctrl+Z",
          disabled: !canUndo,
        },
        {
          kind: "action",
          id: "edit-redo",
          label: "Redo",
          shortcut: "Ctrl+Y",
          disabled: !canRedo,
        },
        { kind: "separator" },
        {
          kind: "action",
          id: "edit-delete",
          label: "Delete selection",
          shortcut: "Del",
          disabled: !canDelete,
        },
        {
          kind: "action",
          id: "edit-toggle-construction",
          label: "Toggle construction",
          shortcut: "C",
          disabled: !canToggleConstruction,
        },
        {
          kind: "action",
          id: "edit-construction-mode",
          label: createAsConstruction
            ? "Create as solid"
            : "Create as construction",
        },
      ],
    },
    {
      id: "sketch",
      label: "Sketch",
      items: [
        toolItem("select", "Select", activeTool),
        toolItem("point", "Point", activeTool),
        toolItem("line", "Line", activeTool),
        toolItem("rectangle", "Rectangle", activeTool),
        toolItem("circle", "Circle", activeTool),
        toolItem("arc", "Arc", activeTool),
      ],
    },
    {
      id: "constraints",
      label: "Constraints",
      items: [
        toolItem("coincident", "Coincident", activeTool),
        toolItem("horizontal", "Horizontal", activeTool),
        toolItem("vertical", "Vertical", activeTool),
        toolItem("parallel", "Parallel", activeTool),
        toolItem("perpendicular", "Perpendicular", activeTool),
        toolItem("tangent", "Tangent", activeTool),
        toolItem("concentric", "Concentric", activeTool),
        toolItem("midpoint", "Midpoint", activeTool),
        toolItem("equal", "Equal", activeTool),
        toolItem("symmetric", "Symmetric", activeTool),
        toolItem("point-on-object", "Point on object", activeTool),
        toolItem("fix", "Fix", activeTool),
        { kind: "separator" },
        toolItem("dim-length", "Length", activeTool),
        toolItem("dim-horizontal-distance", "Horizontal distance", activeTool),
        toolItem("dim-vertical-distance", "Vertical distance", activeTool),
        toolItem("dim-radius", "Radius", activeTool),
        toolItem("dim-diameter", "Diameter", activeTool),
        toolItem("dim-angle", "Angle", activeTool),
        toolItem("dim-offset-x-axis", "Offset X", activeTool),
        toolItem("dim-offset-y-axis", "Offset Y", activeTool),
      ],
    },
    {
      id: "tools",
      label: "Tools",
      items: [
        toolItem("trim", "Trim", activeTool),
        toolItem("extend", "Extend", activeTool),
        toolItem("mirror", "Mirror", activeTool),
        toolItem("fillet", "Fillet", activeTool),
        toolItem("chamfer", "Chamfer", activeTool),
      ],
    },
  ];

  useEffect(() => {
    if (openMenuId === null) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuId]);

  return (
    <nav className="menu-bar" aria-label="Application menu" ref={rootRef}>
      <span className="app-title" data-testid="app-title">
        Sketcher
      </span>
      <ul className="menu-bar-list" role="menubar">
        {menus.map((menu) => {
          const isOpen = openMenuId === menu.id;
          const menuId = `${baseId}-${menu.id}`;
          return (
            <li key={menu.id} className="menu-bar-item" role="none">
              <button
                type="button"
                className={isOpen ? "menu-trigger is-open" : "menu-trigger"}
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={menuId}
                data-testid={`menu-${menu.id}`}
                onClick={() =>
                  setOpenMenuId((current) => (current === menu.id ? null : menu.id))
                }
                onMouseEnter={() => {
                  if (openMenuId !== null) {
                    setOpenMenuId(menu.id);
                  }
                }}
              >
                {menu.label}
              </button>
              {isOpen ? (
                <ul className="menu-dropdown" role="menu" id={menuId}>
                  {menu.items.map((item, index) => {
                    if (item.kind === "separator") {
                      return (
                        <li
                          key={`sep-${menu.id}-${index}`}
                          className="menu-separator"
                          role="separator"
                        />
                      );
                    }
                    return (
                      <li key={item.id} role="none">
                        <button
                          type="button"
                          role="menuitem"
                          className="menu-item"
                          disabled={item.disabled === true}
                          data-testid={`menu-action-${item.id}`}
                          onClick={() => {
                            onAction(item.id);
                            setOpenMenuId(null);
                          }}
                        >
                          <span className="menu-item-label">{item.label}</span>
                          {item.shortcut !== undefined ? (
                            <span className="menu-item-shortcut">{item.shortcut}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function toolItem(
  tool: ActiveTool,
  label: string,
  activeTool: ActiveTool,
): MenuItem {
  return {
    kind: "action",
    id: `tool:${tool}`,
    label: activeTool === tool ? `✓ ${label}` : label,
  };
}
