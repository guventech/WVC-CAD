import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";
import { ToolIconButton } from "../icons/ToolIconButton.tsx";
import { GEOMETRY_TOOL_IDS, renderToolGlyph } from "../icons/toolGlyphs.tsx";

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
  { id: "arc3", label: "3-pt Arc", title: "Create three-point arcs" },
  { id: "trim", label: "Trim", title: "Trim a line to a crossing boundary" },
  { id: "extend", label: "Extend", title: "Extend a line to a crossing boundary" },
  {
    id: "mirror",
    label: "Mirror",
    title: "Mirror selected geometry across a line or axis",
  },
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
        <ToolIconButton
          key={tool.id}
          label={tool.label}
          title={tool.title}
          icon={renderToolGlyph(tool.id)}
          pressed={activeTool === tool.id}
          onClick={() => onToolChange(tool.id)}
          testId={`tool-${tool.id}`}
        />
      ))}
      <ToolIconButton
        label="Construction"
        title="Create new geometry as construction/reference (dashed)"
        icon={renderToolGlyph("construction")}
        pressed={createAsConstruction}
        onClick={() => onCreateAsConstructionChange(!createAsConstruction)}
        testId="tool-construction"
      />
      <ToolIconButton
        label="Toggle construction"
        title="Toggle construction on selected geometry"
        icon={renderToolGlyph("toggle-construction")}
        disabled={!canToggleConstruction}
        onClick={onToggleConstruction}
        testId="tool-toggle-construction"
      />
    </div>
  );
}

/** Exposed for coverage checks against the glyph catalog. */
export function geometryToolbarToolIds(): readonly ActiveTool[] {
  return GEOMETRY_TOOL_IDS;
}
