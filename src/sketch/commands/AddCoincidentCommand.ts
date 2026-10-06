import {
  classifyCoincident,
  enforceCoincidentConstraints,
} from "../constraints/Coincident.ts";
import { createCoincidentConstraint } from "../constraints/ConstraintFactory.ts";
import {
  isLineObjectReference,
  isPointLikeReference,
  normalizePointLikeRef,
  resolveConstraintPoint,
  sameConstraintRef,
} from "../constraints/ConstraintRef.ts";
import { validateConstraintStructure } from "../constraints/ConstraintValidator.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import { isDatumOriginId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";
import {
  addConstraintToSketch,
} from "./AddConstraintCommand.ts";

/**
 * Create an undoable coincident constraint between two picks.
 * Merges geometry immediately; maintenance keeps it during later edits.
 */
export function createAddCoincidentCommand(
  sketch: Sketch,
  first: ConstraintReference,
  second: ConstraintReference,
  options?: { readonly id?: string },
): SketchCommand | null {
  const prepared = prepareCoincidentConstraint(sketch, first, second, options?.id);
  if (prepared === null) {
    return null;
  }

  const { constraint } = prepared;
  const previousGeometry = sketch.geometry;
  const previousConstraints = sketch.constraints;

  return {
    label: `Add coincident ${constraint.id}`,
    apply(current) {
      if (current.constraints.some((item) => item.id === constraint.id)) {
        return current;
      }
      const next = prepareCoincidentConstraint(
        current,
        first,
        second,
        constraint.id,
      );
      if (next === null) {
        return current;
      }
      return addConstraintToSketch(next.mergedSketch, next.constraint);
    },
    undo(current) {
      return {
        ...current,
        geometry: previousGeometry,
        constraints: previousConstraints,
      };
    },
  };
}

/** Apply coincident merge + insert without command wrapping. */
export function addCoincidentToSketch(
  sketch: Sketch,
  first: ConstraintReference,
  second: ConstraintReference,
  options?: { readonly id?: string },
): Sketch | null {
  const prepared = prepareCoincidentConstraint(sketch, first, second, options?.id);
  if (prepared === null) {
    return null;
  }
  return addConstraintToSketch(prepared.mergedSketch, prepared.constraint);
}

function prepareCoincidentConstraint(
  sketch: Sketch,
  first: ConstraintReference,
  second: ConstraintReference,
  id?: string,
): {
  readonly constraint: Constraint;
  readonly mergedSketch: Sketch;
} | null {
  const refs = normalizeCoincidentPair(sketch, first, second);
  if (refs === null) {
    return null;
  }

  const constraint = createCoincidentConstraint(
    id ?? createEntityId("coincident"),
    refs[0],
    refs[1],
  );

  if (sketch.constraints.some((item) => item.id === constraint.id)) {
    return null;
  }
  if (hasDuplicateCoincident(sketch, refs[0], refs[1])) {
    return null;
  }

  const classified = classifyCoincident(
    { ...sketch, constraints: [...sketch.constraints, constraint] },
    constraint,
  );
  if (classified === null) {
    return null;
  }

  const mergedSketch = mergeForNewCoincident(sketch, refs[0], refs[1]);
  if (mergedSketch === null) {
    return null;
  }

  const validation = validateConstraintStructure(mergedSketch, constraint);
  if (!validation.ok) {
    return null;
  }

  return { constraint, mergedSketch };
}

function mergeForNewCoincident(
  sketch: Sketch,
  first: ConstraintReference,
  second: ConstraintReference,
): Sketch | null {
  const aPoint = isPointLikeReference(sketch, first)
    ? normalizePointLikeRef(sketch, first)
    : null;
  const bPoint = isPointLikeReference(sketch, second)
    ? normalizePointLikeRef(sketch, second)
    : null;

  const temporary = createCoincidentConstraint(
    "__temp-coincident__",
    first,
    second,
  );
  const withTemp = {
    ...sketch,
    constraints: [...sketch.constraints, temporary],
  };

  if (aPoint !== null && bPoint !== null) {
    const aIsDatum = isDatumOriginId(sketch.frame, aPoint.entityId);
    const bIsDatum = isDatumOriginId(sketch.frame, bPoint.entityId);
    if (aIsDatum && bIsDatum) {
      return null;
    }
    // Prefer the fixed datum as the merge target so geometry moves to the frame.
    const fixedRef = aIsDatum ? aPoint : bIsDatum ? bPoint : aPoint;
    const movableRef = aIsDatum ? bPoint : bIsDatum ? aPoint : bPoint;
    const anchor = resolveConstraintPoint(sketch, fixedRef);
    if (anchor === null) {
      return null;
    }
    const enforced = enforceCoincidentConstraints(withTemp, [
      { ref: fixedRef, position: anchor },
      { ref: movableRef, position: anchor },
    ]);
    return {
      ...enforced,
      constraints: sketch.constraints,
    };
  }

  const enforced = enforceCoincidentConstraints(withTemp);
  return {
    ...enforced,
    constraints: sketch.constraints,
  };
}

function normalizeCoincidentPair(
  sketch: Sketch,
  first: ConstraintReference,
  second: ConstraintReference,
): [ConstraintReference, ConstraintReference] | null {
  const aPoint = isPointLikeReference(sketch, first)
    ? normalizePointLikeRef(sketch, first)
    : null;
  const bPoint = isPointLikeReference(sketch, second)
    ? normalizePointLikeRef(sketch, second)
    : null;
  const aLine = isLineObjectReference(sketch, first) ? first : null;
  const bLine = isLineObjectReference(sketch, second) ? second : null;

  if (aPoint !== null && bPoint !== null) {
    if (sameConstraintRef(aPoint, bPoint)) {
      return null;
    }
    return [aPoint, bPoint];
  }
  if (aPoint !== null && bLine !== null) {
    return [aPoint, bLine];
  }
  if (bPoint !== null && aLine !== null) {
    return [bPoint, aLine];
  }
  return null;
}

function hasDuplicateCoincident(
  sketch: Sketch,
  first: ConstraintReference,
  second: ConstraintReference,
): boolean {
  return sketch.constraints.some((constraint) => {
    if (constraint.type !== "coincident" || constraint.references.length !== 2) {
      return false;
    }
    const [a, b] = constraint.references;
    if (a === undefined || b === undefined) {
      return false;
    }
    return (
      (sameConstraintRef(a, first) && sameConstraintRef(b, second)) ||
      (sameConstraintRef(a, second) && sameConstraintRef(b, first))
    );
  });
}
