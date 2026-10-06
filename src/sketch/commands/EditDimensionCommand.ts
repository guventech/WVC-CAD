import {
  listUnsatisfiedConstraints,
  maintainConstraints,
} from "../constraints/ConstraintMaintenance.ts";
import {
  isSupportedDimensionType,
  measureDimension,
  validateDimensionValue,
} from "../constraints/Dimensions.ts";
import {
  diagnoseEditConstraintConflict,
  type ConstraintConflict,
} from "../constraints/OverConstraint.ts";
import type { Constraint } from "../model/Constraint.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import {
  findChamferFeatureForEntity,
  findFilletFeatureForEntity,
  listFilletFeaturesForEntity,
  type ChamferFeatureIds,
} from "../model/FilletChamferFeature.ts";
import {
  applyAxisOffsetToRectangleEdge,
  applyFilletRadiusEdit,
  applyLengthToFilletedEdge,
  findChamferAngleConstraint,
  rebuildChamferGeometry,
} from "../geometry/FilletChamferOps.ts";
import {
  findRectangleFeatureForGroupMember,
  otherDrivingSameAxisOffset,
  rectangleGroupEntityIds,
  translateGeometryByIds,
} from "../model/RectangleFillet.ts";
import type { Sketch } from "../model/Sketch.ts";
import { type PrepareOutcome } from "./AddMaintainedConstraintCommand.ts";
import type { SketchCommand } from "./Command.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import { resolveConstraintPoint } from "../constraints/ConstraintRef.ts";

export interface DimensionEdit {
  /** New value in model units (mm, or radians for angle). */
  readonly value?: number;
  /** Switch between driving and reference (measurement) mode. */
  readonly driving?: boolean;
}

export type EditDimensionOutcome =
  | { readonly ok: true; readonly command: SketchCommand }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly conflict?: ConstraintConflict;
    };

function chamferFeatureForDimension(
  sketch: Sketch,
  constraint: Constraint,
): ChamferFeatureIds | null {
  if (constraint.type === "length" && constraint.references[0] !== undefined) {
    const entityId = constraint.references[0].entityId;
    const feature = findChamferFeatureForEntity(sketch.constraints, entityId);
    if (feature !== null && feature.chamferLineId === entityId) {
      return feature;
    }
    return null;
  }
  if (constraint.type === "angle") {
    for (const ref of constraint.references) {
      const feature = findChamferFeatureForEntity(sketch.constraints, ref.entityId);
      if (feature !== null && feature.chamferLineId === ref.entityId) {
        return feature;
      }
    }
  }
  return null;
}

/**
 * Change a dimension's value and/or driving flag, then maintain constraints.
 * Switching reference → driving adopts the current measurement unless a value
 * is given, so geometry does not jump.
 */
export function prepareEditDimension(
  sketch: Sketch,
  constraintId: string,
  edit: DimensionEdit,
): PrepareOutcome {
  const existing = sketch.constraints.find((item) => item.id === constraintId);
  if (existing === undefined || !isSupportedDimensionType(existing.type)) {
    return { ok: false, reason: `Dimension ${constraintId} not found.` };
  }

  const wasDriving = isDrivingConstraint(existing);
  const driving = edit.driving ?? wasDriving;
  const measured = measureDimension(sketch, existing.type, existing.references);
  const value =
    edit.value ??
    (driving && !wasDriving && measured !== null ? measured : existing.value);
  if (value === undefined) {
    return { ok: false, reason: "Dimension has no value." };
  }
  const invalid = validateDimensionValue(existing.type, value);
  if (invalid !== null) {
    return { ok: false, reason: invalid };
  }
  if (driving === wasDriving && value === existing.value) {
    return { ok: false, reason: "Dimension unchanged." };
  }

  const updated: Constraint = { ...existing, value, driving };
  let replaced: Sketch = {
    ...sketch,
    constraints: sketch.constraints.map((item) =>
      item.id === constraintId ? updated : item,
    ),
  };

  // Offset X/Y on a rectangle group: locate = rigid translate; size (another
  // same-axis Offset already pins the opposite side) = move that edge + rebuild.
  if (
    driving &&
    (existing.type === "coordinate-x" || existing.type === "coordinate-y") &&
    existing.references[0] !== undefined
  ) {
    const ref = existing.references[0];
    const feature = findRectangleFeatureForGroupMember(sketch, ref.entityId);
    if (feature !== null) {
      const current = resolveConstraintPoint(sketch, ref);
      if (current !== null) {
        const sizing = otherDrivingSameAxisOffset(
          sketch,
          feature,
          existing.type,
          constraintId,
        );
        if (sizing) {
          const sized = applyAxisOffsetToRectangleEdge(
            replaced,
            ref.entityId,
            existing.type,
            value,
          );
          if (sized === null) {
            return {
              ok: false,
              reason:
                "Offset cannot resize that edge with the connected fillets.",
            };
          }
          replaced = {
            ...sized,
            constraints: sized.constraints.map((item) =>
              item.id === constraintId ? { ...item, value, driving } : item,
            ),
          };
        } else {
          const delta =
            existing.type === "coordinate-x"
              ? { x: value - current.x, y: 0 }
              : { x: 0, y: value - current.y };
          const groupIds = rectangleGroupEntityIds(replaced, feature);
          replaced = {
            ...replaced,
            geometry: translateGeometryByIds(
              replaced.geometry,
              groupIds,
              delta,
            ),
          };
        }
      }
    }
  }

  // Fillet radius / diameter: seat parents for target R + lengths, then rebuild.
  if (
    (existing.type === "radius" || existing.type === "diameter") &&
    driving &&
    existing.references[0] !== undefined
  ) {
    const arcId = existing.references[0].entityId;
    const fillet = findFilletFeatureForEntity(replaced.constraints, arcId);
    if (fillet !== null) {
      const radiusMm = existing.type === "radius" ? value : value / 2;
      const rebuilt = applyFilletRadiusEdit(replaced, fillet, radiusMm);
      if (rebuilt === null) {
        const conflict = diagnoseEditConstraintConflict(
          sketch,
          replaced,
          constraintId,
        );
        return {
          ok: false,
          reason: "Fillet cannot use that radius with the connected lines.",
          conflict,
        };
      }
      replaced = {
        ...rebuilt,
        constraints: rebuilt.constraints.map((item) =>
          item.id === constraintId ? { ...item, value, driving } : item,
        ),
      };
      if (listUnsatisfiedConstraints(replaced).length > 0) {
        const conflict = diagnoseEditConstraintConflict(
          sketch,
          replaced,
          constraintId,
        );
        return {
          ok: false,
          reason: "Fillet cannot use that radius with the connected lines.",
          conflict,
        };
      }
      return {
        ok: true,
        sketch: replaced,
        constraint: updated,
      };
    }
  }

  // Chamfer length / angle: rebuild connected lines + face before solving.
  if (driving && (existing.type === "length" || existing.type === "angle")) {
    const chamfer = chamferFeatureForDimension(replaced, existing);
    if (chamfer !== null) {
      const angleInfo = findChamferAngleConstraint(replaced, chamfer);
      const lengthMm =
        existing.type === "length"
          ? value
          : (replaced.constraints.find((c) => c.id === chamfer.constraintId)?.value ??
            chamfer.lengthMm);
      const angleRad =
        existing.type === "angle"
          ? value
          : angleInfo !== null
            ? replaced.constraints.find((c) => c.id === angleInfo.constraintId)?.value
            : undefined;
      const rebuilt = rebuildChamferGeometry(replaced, chamfer, lengthMm, angleRad);
      if (rebuilt === null) {
        return {
          ok: false,
          reason: "Chamfer cannot use that length or angle with the connected lines.",
        };
      }
      replaced = rebuilt;
      replaced = {
        ...replaced,
        constraints: replaced.constraints.map((item) =>
          item.id === constraintId ? { ...item, value, driving } : item,
        ),
      };
    } else if (
      existing.type === "length" &&
      existing.references[0] !== undefined &&
      listFilletFeaturesForEntity(
        replaced.constraints,
        existing.references[0].entityId,
      ).length > 0
    ) {
      // Filleted parent edge: grow/shrink via partner-edge shift + rebuild.
      const applied = applyLengthToFilletedEdge(
        replaced,
        existing.references[0].entityId,
        value,
      );
      if (applied === null) {
        return {
          ok: false,
          reason: "Cannot change that length with the connected fillets.",
        };
      }
      replaced = applied;
      replaced = {
        ...replaced,
        constraints: replaced.constraints.map((item) =>
          item.id === constraintId ? { ...item, value, driving } : item,
        ),
      };
    }
  }

  const maintained = maintainConstraints(replaced);
  if (!maintained.satisfied) {
    const conflict = diagnoseEditConstraintConflict(sketch, replaced, constraintId);
    return { ok: false, reason: conflict.reason, conflict };
  }

  // Confirm length still matches after fillet-aware apply + solve.
  if (driving && existing.type === "length") {
    const measured = measureDimension(
      maintained.sketch,
      "length",
      updated.references,
    );
    if (
      measured === null ||
      Math.abs(measured - value) > TOLERANCE.coincidence * 100
    ) {
      return {
        ok: false,
        reason: "Length could not be applied with the connected fillets.",
      };
    }
  }

  return { ok: true, sketch: maintained.sketch, constraint: updated };
}

export function createEditDimensionCommand(
  sketch: Sketch,
  constraintId: string,
  edit: DimensionEdit,
): EditDimensionOutcome {
  const prepared = prepareEditDimension(sketch, constraintId, edit);
  if (!prepared.ok) {
    return {
      ok: false,
      reason: prepared.reason,
      conflict: prepared.conflict,
    };
  }
  const { constraint, sketch: preparedSketch } = prepared;
  const previousGeometry = sketch.geometry;
  const previousConstraints = sketch.constraints;
  const resolvedEdit = { value: constraint.value, driving: constraint.driving };
  const sketchAtCreate = sketch;

  return {
    ok: true,
    command: {
      label: `Edit dimension ${constraintId}`,
      apply(current) {
        const next = prepareEditDimension(current, constraintId, resolvedEdit);
        if (next.ok) {
          return next.sketch;
        }
        if (current === sketchAtCreate) {
          return preparedSketch;
        }
        return current;
      },
      undo(current) {
        return { ...current, geometry: previousGeometry, constraints: previousConstraints };
      },
    },
  };
}
