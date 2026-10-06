import {
  createAngleConstraint,
  createChamferFeatureConstraint,
  createCoincidentConstraint,
  createFilletFeatureConstraint,
  createLengthConstraint,
  createRadiusConstraint,
} from "../constraints/ConstraintFactory.ts";
import { angleBetweenLines } from "../constraints/Dimensions.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import {
  findFilletFeatureForEntity,
  type FilletFeatureIds,
} from "../model/FilletChamferFeature.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Point2D } from "./Point2D.ts";
import { distance } from "./GeometryMath.ts";
import {
  computeLineLineChamfer,
  computeLineLineFillet,
  type ChamferGeometryPlan,
  type FilletGeometryPlan,
} from "./FilletChamferMath.ts";
import {
  FILLET_RECTANGLE_BLOCKED_REASON,
  CHAMFER_RECTANGLE_BLOCKED_REASON,
  applyChamferPlan,
  applyFilletPlan,
  blockRectangle,
  finalizeAfterCornerEdit,
  findLine,
  nearerEndpointRole,
  orientChamferToReference,
  resolveChamferDistance,
  resolveFilletRadius,
  type ChamferOutcome,
  type FilletOutcome,
} from "./FilletChamferOpsShared.ts";

export function applyFilletLines(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  pickPoint: Point2D,
  radius?: number,
): FilletOutcome {
  if (line1Id === line2Id) {
    return { ok: false, reason: "Lines must be different" };
  }
  const blocked = blockRectangle(
    sketch,
    line1Id,
    line2Id,
    FILLET_RECTANGLE_BLOCKED_REASON,
  );
  if (blocked !== null) {
    return { ok: false, reason: blocked };
  }

  const line1 = findLine(sketch, line1Id);
  const line2 = findLine(sketch, line2Id);
  if (line1 === null || line2 === null) {
    return { ok: false, reason: "Lines are not valid for fillet" };
  }

  const r = resolveFilletRadius(line1, line2, pickPoint, radius);
  const plan = computeLineLineFillet(line1, line2, r, pickPoint);
  if (plan === null) {
    return { ok: false, reason: "Lines are not valid for fillet" };
  }

  const mutated = applyFilletPlan(sketch, line1Id, line2Id, plan);
  if (mutated === null) {
    return { ok: false, reason: "Lines are not valid for fillet" };
  }

  const feature = createFilletFeatureConstraint(
    createEntityId("constraint"),
    line1Id,
    line2Id,
    plan.arc.id,
    r,
  );
  const radiusDim = createRadiusConstraint(
    createEntityId("constraint"),
    plan.arc.id,
    r,
    { driving: true },
  );
  const withConstraints: Sketch = {
    ...mutated,
    constraints: [...mutated.constraints, feature, radiusDim],
  };
  return finalizeAfterCornerEdit(
    withConstraints,
    line1Id,
    line2Id,
    plan.intersection,
  );
}

export function applyChamferLines(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  pickPoint: Point2D,
  chamferDistance?: number,
): ChamferOutcome {
  if (line1Id === line2Id) {
    return { ok: false, reason: "Lines must be different" };
  }
  const blocked = blockRectangle(
    sketch,
    line1Id,
    line2Id,
    CHAMFER_RECTANGLE_BLOCKED_REASON,
  );
  if (blocked !== null) {
    return { ok: false, reason: blocked };
  }

  const line1 = findLine(sketch, line1Id);
  const line2 = findLine(sketch, line2Id);
  if (line1 === null || line2 === null) {
    return { ok: false, reason: "Lines are not valid for chamfer" };
  }

  const d = resolveChamferDistance(line1, line2, pickPoint, chamferDistance);
  const plan = computeLineLineChamfer(line1, line2, d, pickPoint);
  if (plan === null) {
    return { ok: false, reason: "Lines are not valid for chamfer" };
  }

  const mutated = applyChamferPlan(sketch, line1Id, line2Id, plan);
  if (mutated === null) {
    return { ok: false, reason: "Lines are not valid for chamfer" };
  }

  const chamferLine = mutated.geometry[mutated.geometry.length - 1];
  if (chamferLine === undefined || chamferLine.type !== "line") {
    return { ok: false, reason: "Lines are not valid for chamfer" };
  }

  const referenceLine = findLine(mutated, line1Id);
  if (referenceLine === null) {
    return { ok: false, reason: "Lines are not valid for chamfer" };
  }
  const oriented = orientChamferToReference(
    { start: chamferLine.start, end: chamferLine.end },
    referenceLine,
  );
  const orientedChamfer: LineGeometry = {
    ...chamferLine,
    start: oriented.start,
    end: oriented.end,
  };
  const withOriented: Sketch = {
    ...mutated,
    geometry: mutated.geometry.map((entity) =>
      entity.id === chamferLine.id ? orientedChamfer : entity,
    ),
  };

  const lengthMm = distance(orientedChamfer.start, orientedChamfer.end);
  const angleRad = angleBetweenLines(referenceLine, orientedChamfer);
  const feature = createChamferFeatureConstraint(
    createEntityId("constraint"),
    line1Id,
    line2Id,
    orientedChamfer.id,
    lengthMm,
  );
  const lengthDim = createLengthConstraint(
    createEntityId("constraint"),
    orientedChamfer.id,
    lengthMm,
    { driving: true },
  );
  const angleDim = createAngleConstraint(
    createEntityId("constraint"),
    line1Id,
    orientedChamfer.id,
    angleRad,
    { driving: true },
  );
  const line1After = findLine(withOriented, line1Id);
  const line2After = findLine(withOriented, line2Id);
  const blendCoincidents =
    line1After !== null && line2After !== null
      ? [
          createCoincidentConstraint(
            createEntityId("constraint"),
            { entityId: orientedChamfer.id, role: "start" },
            {
              entityId: line1Id,
              role: nearerEndpointRole(line1After, orientedChamfer.start),
            },
          ),
          createCoincidentConstraint(
            createEntityId("constraint"),
            { entityId: orientedChamfer.id, role: "end" },
            {
              entityId: line2Id,
              role: nearerEndpointRole(line2After, orientedChamfer.end),
            },
          ),
        ]
      : [];
  const withConstraints: Sketch = {
    ...withOriented,
    constraints: [
      ...withOriented.constraints,
      feature,
      lengthDim,
      angleDim,
      ...blendCoincidents,
    ],
  };
  return finalizeAfterCornerEdit(
    withConstraints,
    line1Id,
    line2Id,
    plan.intersection,
  );
}

/** Preview plan without mutating sketch (for tool hover). */
export function previewFilletLines(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  pickPoint: Point2D,
): FilletGeometryPlan | null {
  const line1 = findLine(sketch, line1Id);
  const line2 = findLine(sketch, line2Id);
  if (line1 === null || line2 === null) {
    return null;
  }
  const r = resolveFilletRadius(line1, line2, pickPoint, undefined);
  return computeLineLineFillet(line1, line2, r, pickPoint);
}

export function previewChamferLines(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  pickPoint: Point2D,
): ChamferGeometryPlan | null {
  const line1 = findLine(sketch, line1Id);
  const line2 = findLine(sketch, line2Id);
  if (line1 === null || line2 === null) {
    return null;
  }
  const d = resolveChamferDistance(line1, line2, pickPoint, undefined);
  return computeLineLineChamfer(line1, line2, d, pickPoint);
}

/** Resolve fillet feature for an arc (used by drag / dimension edit). */
export function filletFeatureForArc(
  sketch: Sketch,
  arcId: EntityId,
): FilletFeatureIds | null {
  return findFilletFeatureForEntity(sketch.constraints, arcId);
}
