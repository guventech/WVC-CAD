import type { Constraint } from "../model/Constraint.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { EntityId } from "../model/Geometry.ts";
import { isDatumId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";

/**
 * Copy constraints whose references all lie in the mirrored source set
 * (or world datums), remapping entity ids via `idMap`.
 * Skips feature constraints (rectangle/fillet/chamfer) — those need rebuild.
 */
export function mirrorConstraintsAcrossMap(
  sketch: Sketch,
  sourceIds: ReadonlySet<EntityId>,
  idMap: ReadonlyMap<EntityId, EntityId>,
): readonly Constraint[] {
  const copied: Constraint[] = [];
  for (const constraint of sketch.constraints) {
    if (
      constraint.type === "rectangle" ||
      constraint.type === "fillet" ||
      constraint.type === "chamfer"
    ) {
      continue;
    }
    if (
      !constraint.references.every(
        (ref) =>
          sourceIds.has(ref.entityId) || isDatumId(sketch.frame, ref.entityId),
      )
    ) {
      continue;
    }
    // Need at least one remapped geometry ref (not datum-only).
    if (!constraint.references.some((ref) => idMap.has(ref.entityId))) {
      continue;
    }
    copied.push({
      ...constraint,
      id: createEntityId("constraint"),
      references: constraint.references.map((ref) => {
        const mapped = idMap.get(ref.entityId);
        return mapped === undefined ? ref : { ...ref, entityId: mapped };
      }),
    });
  }
  return copied;
}
