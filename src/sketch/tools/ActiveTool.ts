export type ActiveTool =
  | "select"
  | "point"
  | "line"
  | "rectangle"
  | "polygon"
  | "slot"
  | "circle"
  | "arc"
  | "arc3"
  | "arcTangent"
  | "trim"
  | "extend"
  | "offset"
  | "mirror"
  | "fillet"
  | "chamfer"
  | "coincident"
  | ConstraintPickToolId;

/** Tools that build H/V, parallel/perp, Fix, or dimensional constraints from picks. */
export type ConstraintPickToolId =
  | "horizontal"
  | "vertical"
  | "parallel"
  | "perpendicular"
  | "tangent"
  | "concentric"
  | "midpoint"
  | "equal"
  | "symmetric"
  | "point-on-object"
  | "fix"
  | "dim-distance"
  | "dim-radial"
  | "dim-angle";

const CONSTRAINT_PICK_TOOLS: readonly ConstraintPickToolId[] = [
  "horizontal",
  "vertical",
  "parallel",
  "perpendicular",
  "tangent",
  "concentric",
  "midpoint",
  "equal",
  "symmetric",
  "point-on-object",
  "fix",
  "dim-distance",
  "dim-radial",
  "dim-angle",
];

export function isConstraintPickTool(tool: ActiveTool): tool is ConstraintPickToolId {
  return (CONSTRAINT_PICK_TOOLS as readonly string[]).includes(tool);
}
