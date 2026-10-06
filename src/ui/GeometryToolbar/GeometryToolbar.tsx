import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";

const TOOLS: readonly {
  readonly id: ActiveTool;
  readonly label: string;
  readonly title: string;
}[] = [
  { id: "select", label: "Select", title: "Select and move geometry" },
  { id: "point", label: "Point", title: "Create points" },
  { id: "line", label: "Line", title: "Create lines" },
  { id: "rectangle", label: "Rectangle", title: "Create rectangles" },
  { id: "circle", label: "Circle", title: "Create circles" },
  { id: "arc", label: "Arc", title: "Create center-point arcs" },
  { id: "trim", label: "Trim", title: "Trim a line to a crossing boundary" },
  { id: "extend", label: "Extend", title: "Extend a line to a crossing boundary" },
  { id: "mirror", label: "Mirror", title: "Mirror selected geometry across a line or axis" },
  { id: "fillet", label: "Fillet", title: "Round a corner between two lines" },
  { id: "chamfer", label: "Chamfer", title: "Bevel a corner between two lines" },
];

type GeometryToolbarProps = {
  readonly activeTool: ActiveTool;
  readonly onToolChange: (tool: ActiveTool) => void;
  readonly createAsConstruction: boolean;
  readonly onCreateAsConstructionChange: (value: boolean) => void;
  readonly canToggleConstruction: boolean;
  readonly onToggleConstruction: () => void;
};

export function GeometryToolbar({
  activeTool,
  onToolChange,
  createAsConstruction,
  onCreateAsConstructionChange,
  canToggleConstruction,
  onToggleConstruction,
}: GeometryToolbarProps) {
  return (
    <div className="toolbar-group" role="toolbar" aria-label="Geometry">
      <span className="toolbar-label">Geometry</span>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          aria-pressed={activeTool === tool.id}
          className={activeTool === tool.id ? "is-active" : undefined}
          onClick={() => onToolChange(tool.id)}
          title={tool.title}
        >
          {tool.label}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={createAsConstruction}
        className={createAsConstruction ? "is-active" : undefined}
        onClick={() => onCreateAsConstructionChange(!createAsConstruction)}
        title="Create new geometry as construction/reference (dashed)"
      >
        Construction
      </button>
      <button
        type="button"
        disabled={!canToggleConstruction}
        onClick={onToggleConstruction}
        title="Toggle construction on selected geometry"
      >
        Toggle Constr.
      </button>
    </div>
  );
}
