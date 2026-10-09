export type ActiveTool =
  | "select"
  | "point"
  | "line"
  | "rectangle"
  | "circle"
  | "arc"
  | "trim"
  | "extend"
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
  | "dim-radius"
  | "dim-diameter"
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
  "dim-radius",
  "dim-diameter",
  "dim-angle",
];

export function isConstraintPickTool(tool: ActiveTool): tool is ConstraintPickToolId {
  return (CONSTRAINT_PICK_TOOLS as readonly string[]).includes(tool);
}
