import {
  createEqualConstraint,
  createParallelConstraint,
  createTangentConstraint,
} from "../constraints/ConstraintFactory.ts";
import { slotOutlineFromCenters } from "../geometry/SlotMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint } from "../model/Constraint.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { SketchCommand } from "./Command.ts";
import {
  createArcGeometry,
  createLineGeometry,
} from "./CreateGeometryCommand.ts";

/**
 * Capsule slot: two parallel lines + two semicircle caps.
 * Convenience create (no feature residual); tangents / parallel / equal radii.
 */
export function createAddSlotCommand(
  centerA: Point2D,
  centerB: Point2D,
  halfWidth: number,
  options?: { readonly construction?: boolean },
): SketchCommand | null {
  const outline = slotOutlineFromCenters(centerA, centerB, halfWidth);
  if (outline === null) {
    return null;
  }
  const construction = options?.construction ?? false;

  const lineA = createLineGeometry(outline.lineA.start, outline.lineA.end, {
    construction,
  });
  const lineB = createLineGeometry(outline.lineB.start, outline.lineB.end, {
    construction,
  });
  const arcStart = createArcGeometry(
    outline.arcStart.center,
    outline.arcStart.radius,
    outline.arcStart.startAngle,
    outline.arcStart.endAngle,
    { construction },
  );
  const arcEnd = createArcGeometry(
    outline.arcEnd.center,
    outline.arcEnd.radius,
    outline.arcEnd.startAngle,
    outline.arcEnd.endAngle,
    { construction },
  );
  if (lineA === null || lineB === null || arcStart === null || arcEnd === null) {
    return null;
  }

  const constraints: Constraint[] = [
    createParallelConstraint(
      createEntityId("constraint"),
      lineA.id,
      lineB.id,
    ),
    createEqualConstraint(
      createEntityId("constraint"),
      arcStart.id,
      arcEnd.id,
    ),
    createTangentConstraint(
      createEntityId("constraint"),
      lineA.id,
      arcStart.id,
    ),
    createTangentConstraint(
      createEntityId("constraint"),
      lineA.id,
      arcEnd.id,
    ),
    createTangentConstraint(
      createEntityId("constraint"),
      lineB.id,
      arcStart.id,
    ),
    createTangentConstraint(
      createEntityId("constraint"),
      lineB.id,
      arcEnd.id,
    ),
  ];

  const geometryIds = new Set<EntityId>([
    lineA.id,
    lineB.id,
    arcStart.id,
    arcEnd.id,
  ]);
  const constraintIds = new Set(constraints.map((c) => c.id));

  return {
    label: `Add slot ${lineA.id}`,
    apply(sketch) {
      if (sketch.geometry.some((entity) => geometryIds.has(entity.id))) {
        return sketch;
      }
      return {
        ...sketch,
        geometry: [...sketch.geometry, lineA, lineB, arcStart, arcEnd],
        constraints: [...sketch.constraints, ...constraints],
      };
    },
    undo(sketch) {
      return {
        ...sketch,
        geometry: sketch.geometry.filter((entity) => !geometryIds.has(entity.id)),
        constraints: sketch.constraints.filter(
          (constraint) => !constraintIds.has(constraint.id),
        ),
      };
    },
  };
}
