import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";
import { ToolIconButton } from "../icons/ToolIconButton.tsx";
import { GEOMETRY_TOOL_IDS, renderToolGlyph } from "../icons/toolGlyphs.tsx";
import { ShapeToolFlyout } from "./ShapeToolFlyout.tsx";

const BEFORE_SHAPE: readonly {
  readonly id: ActiveTool;
  readonly label: string;
  readonly title: string;
}[] = [
  { id: "select", label: "Select", title: "Select and move geometry" },
  { id: "point", label: "Point", title: "Create points" },
  { id: "line", label: "Line", title: "Create lines" },
];

const AFTER_SHAPE: readonly {
  readonly id: ActiveTool;
  readonly label: string;
  readonly title: string;
}[] = [
  { id: "circle", label: "Circle", title: "Create circles" },
  { id: "arc", label: "Arc", title: "Create center-point arcs" },
  { id: "arc3", label: "3-pt Arc", title: "Create three-point arcs" },
  {
    id: "arcTangent",
    label: "Tan Arc",
    title: "Create an arc tangent to a line at an endpoint",
  },
  { id: "trim", label: "Trim", title: "Trim a line to a crossing boundary" },
  { id: "extend", label: "Extend", title: "Extend a line to a crossing boundary" },
  {
    id: "offset",
    label: "Offset",
    title: "Offset a line or closed loop in parallel",
  },
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
  readonly polygonSides?: number | null;
  readonly onPolygonSidesDelta?: (delta: number) => void;
};

export function GeometryToolbar({
  activeTool,
  onToolChange,
  createAsConstruction,
  onCreateAsConstructionChange,
  canToggleConstruction,
  onToggleConstruction,
  polygonSides = null,
  onPolygonSidesDelta,
}: GeometryToolbarProps) {
  return (
    <div className="toolbar-group" role="toolbar" aria-label="Geometry">
      <span className="toolbar-label">Geometry</span>
      {BEFORE_SHAPE.map((tool) => (
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
      <ShapeToolFlyout activeTool={activeTool} onToolChange={onToolChange} />
      {activeTool === "polygon" && onPolygonSidesDelta !== undefined ? (
        <span className="polygon-sides-stepper" aria-label="Polygon sides">
          <button
            type="button"
            className="tool-icon-btn"
            title="Fewer sides ([)"
            aria-label="Fewer polygon sides"
            data-testid="polygon-sides-dec"
            onClick={() => onPolygonSidesDelta(-1)}
          >
            −
          </button>
          <span data-testid="polygon-sides-value" title="Side count (3–32)">
            N={polygonSides ?? "—"}
          </span>
          <button
            type="button"
            className="tool-icon-btn"
            title="More sides (])"
            aria-label="More polygon sides"
            data-testid="polygon-sides-inc"
            onClick={() => onPolygonSidesDelta(1)}
          >
            +
          </button>
        </span>
      ) : null}
      {AFTER_SHAPE.map((tool) => (
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
