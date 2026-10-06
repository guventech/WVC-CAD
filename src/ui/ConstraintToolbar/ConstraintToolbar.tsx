import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";

type ToolButton = {
  readonly id: ActiveTool;
  readonly label: string;
  readonly title: string;
};

const CONSTRAINT_TOOLS: readonly ToolButton[] = [
  {
    id: "coincident",
    label: "Coincident",
    title: "Coincident: pick two points/endpoints/centers, or a point then a line",
  },
  {
    id: "horizontal",
    label: "Horizontal",
    title: "Horizontal: pick a line, or two points/endpoints/centers",
  },
  {
    id: "vertical",
    label: "Vertical",
    title: "Vertical: pick a line, or two points/endpoints/centers",
  },
  {
    id: "parallel",
    label: "Parallel",
    title: "Parallel: pick two lines, or a line and a world axis",
  },
  {
    id: "perpendicular",
    label: "Perpendicular",
    title: "Perpendicular: pick two lines, or a line and a world axis",
  },
  {
    id: "tangent",
    label: "Tangent",
    title: "Tangent: pick a line and a circle/arc, or two circles/arcs",
  },
  {
    id: "concentric",
    label: "Concentric",
    title: "Concentric: pick two circles or arcs (shared center)",
  },
  {
    id: "midpoint",
    label: "Midpoint",
    title: "Midpoint: pick a point/endpoint/center and a line",
  },
  {
    id: "equal",
    label: "Equal",
    title: "Equal: pick two lines (length) or two circles/arcs (radius)",
  },
  {
    id: "symmetric",
    label: "Symmetric",
    title: "Symmetric: pick two points/endpoints/centers and a mirror line or axis",
  },
  {
    id: "point-on-object",
    label: "On object",
    title: "Point on object: pick a point/endpoint/center and a line, circle, or arc",
  },
  {
    id: "fix",
    label: "Fix",
    title:
      "Fix: pick a point/endpoint/center, a line (both ends), or a circle/arc (center + radius)",
  },
  {
    id: "dim-offset-x-axis",
    label: "Offset X",
    title: "Offset from X-axis: pick a point/corner, or a horizontal edge",
  },
  {
    id: "dim-offset-y-axis",
    label: "Offset Y",
    title: "Offset from Y-axis: pick a point/corner, or a vertical edge",
  },
];

const DIMENSION_TOOLS: readonly ToolButton[] = [
  { id: "dim-length", label: "Length", title: "Line length: pick a line" },
  {
    id: "dim-horizontal-distance",
    label: "H distance",
    title: "Horizontal distance: pick a line, or two points",
  },
  {
    id: "dim-vertical-distance",
    label: "V distance",
    title: "Vertical distance: pick a line, or two points",
  },
  { id: "dim-radius", label: "Radius", title: "Radius: pick a circle or arc" },
  { id: "dim-diameter", label: "Diameter", title: "Diameter: pick a circle or arc" },
  { id: "dim-angle", label: "Angle", title: "Angle: pick two lines" },
];

type ConstraintToolbarProps = {
  readonly activeTool: ActiveTool;
  readonly onToolChange: (tool: ActiveTool) => void;
};

export function ConstraintToolbar({
  activeTool,
  onToolChange,
}: ConstraintToolbarProps) {
  return (
    <>
      <ToolGroup
        label="Constraints"
        tools={CONSTRAINT_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />
      <ToolGroup
        label="Dimensions"
        tools={DIMENSION_TOOLS}
        activeTool={activeTool}
        onToolChange={onToolChange}
      />
    </>
  );
}

function ToolGroup({
  label,
  tools,
  activeTool,
  onToolChange,
}: ConstraintToolbarProps & {
  readonly label: string;
  readonly tools: readonly ToolButton[];
}) {
  return (
    <div className="toolbar-group" role="toolbar" aria-label={label}>
      <span className="toolbar-label">{label}</span>
      {tools.map((tool) => (
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
    </div>
  );
}
