import type { ConstraintReference } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import { findEntity } from "./ConstraintRef.ts";

export type SmartRadialRequest = {
  readonly type: "radius" | "diameter";
  readonly references: readonly ConstraintReference[];
};

/**
 * Classify a Radial (Size) dimension pick.
 * - Arc → always `radius`
 * - Circle → `diameter` by default; `radius` when preferRadius (Shift)
 */
export function classifyRadialPick(
  sketch: Sketch,
  curveEntityId: string,
  preferRadius: boolean = false,
): SmartRadialRequest | null {
  const entity = findEntity(sketch, curveEntityId);
  if (entity === undefined) {
    return null;
  }
  if (entity.type === "arc") {
    return {
      type: "radius",
      references: [{ entityId: curveEntityId, role: "entity" }],
    };
  }
  if (entity.type === "circle") {
    return {
      type: preferRadius ? "radius" : "diameter",
      references: [{ entityId: curveEntityId, role: "entity" }],
    };
  }
  return null;
}
