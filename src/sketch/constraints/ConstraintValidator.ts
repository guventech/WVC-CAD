import type { Constraint } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import { isDatumId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import { getConstraintTypeInfo } from "./ConstraintTypes.ts";

export interface ConstraintValidationIssue {
  readonly constraintId: string;
  readonly message: string;
}

export interface ConstraintValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ConstraintValidationIssue[];
}

/**
 * Structural validation only (catalog, arity, entity existence, dimensional value).
 * Does not check geometric satisfaction or conflicts — that is solver work.
 */
export function validateConstraintStructure(
  sketch: Sketch,
  constraint: Constraint,
): ConstraintValidationResult {
  const issues: ConstraintValidationIssue[] = [];
  const info = getConstraintTypeInfo(constraint.type);

  if (info === undefined) {
    issues.push({
      constraintId: constraint.id,
      message: `Unknown constraint type "${constraint.type}".`,
    });
    return { ok: false, issues };
  }

  const refCount = constraint.references.length;
  if (refCount < info.minReferences || refCount > info.maxReferences) {
    issues.push({
      constraintId: constraint.id,
      message: `${info.label} expects ${formatArity(info.minReferences, info.maxReferences)} reference(s); got ${refCount}.`,
    });
  }

  const geometryIds = new Set(sketch.geometry.map((entity) => entity.id));
  for (const reference of constraint.references) {
    if (
      !geometryIds.has(reference.entityId) &&
      !isDatumId(sketch.frame, reference.entityId)
    ) {
      issues.push({
        constraintId: constraint.id,
        message: `Reference entity "${reference.entityId}" is missing from the sketch.`,
      });
    }
  }

  if (info.requiresValue) {
    if (constraint.value === undefined || !Number.isFinite(constraint.value)) {
      issues.push({
        constraintId: constraint.id,
        message: `${info.label} requires a finite numeric value.`,
      });
    }
  }

  if (constraint.type === "fix") {
    const locked = constraint.locked;
    if (
      locked === undefined ||
      !Number.isFinite(locked.x) ||
      !Number.isFinite(locked.y)
    ) {
      issues.push({
        constraintId: constraint.id,
        message: "Fix requires a locked world position (x, y).",
      });
    } else {
      const hasEnd = locked.endX !== undefined || locked.endY !== undefined;
      if (hasEnd && (!Number.isFinite(locked.endX) || !Number.isFinite(locked.endY))) {
        issues.push({
          constraintId: constraint.id,
          message: "Line Fix requires locked endX and endY.",
        });
      }
      if (
        locked.radius !== undefined &&
        (!Number.isFinite(locked.radius) || locked.radius <= 0)
      ) {
        issues.push({
          constraintId: constraint.id,
          message: "Circle Fix requires a positive locked radius.",
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateAllConstraints(
  sketch: Sketch,
): ConstraintValidationResult {
  const issues: ConstraintValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const constraint of sketch.constraints) {
    if (seenIds.has(constraint.id)) {
      issues.push({
        constraintId: constraint.id,
        message: `Duplicate constraint id "${constraint.id}".`,
      });
    }
    seenIds.add(constraint.id);

    const result = validateConstraintStructure(sketch, constraint);
    issues.push(...result.issues);
  }

  return { ok: issues.length === 0, issues };
}

export function referencedEntityIds(
  constraint: Constraint,
): readonly EntityId[] {
  const ids: EntityId[] = [];
  const seen = new Set<EntityId>();
  for (const reference of constraint.references) {
    if (!seen.has(reference.entityId)) {
      seen.add(reference.entityId);
      ids.push(reference.entityId);
    }
  }
  return ids;
}

function formatArity(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}
