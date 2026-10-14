import { resolveConstraintPoint } from "../constraints/ConstraintRef.ts";
import {
  distanceHandles,
  isSupportedDimensionType,
  measureDimension,
  referencedLine,
  resolveCoordinatePoint,
} from "../constraints/Dimensions.ts";
import { orientationHandles } from "../constraints/Orientation.ts";
import { lineRelationAnnotationPoint } from "../constraints/Parallel.ts";
import { tangentAnnotationPoint } from "../constraints/Tangent.ts";
import { concentricAnnotationPoint } from "../constraints/Concentric.ts";
import { equalAnnotationPoint } from "../constraints/Equal.ts";
import { midpointAnnotationPoint } from "../constraints/Midpoint.ts";
import { symmetricAnnotationPoint } from "../constraints/Symmetric.ts";
import { pointOnObjectAnnotationPoint } from "../constraints/PointOnObject.ts";
import { fixAnnotationPoint } from "../constraints/Fix.ts";
import { lineMidpoint, pointOnCircle } from "../geometry/EntityFeatures.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Camera } from "./Camera.ts";
import { worldToScreen } from "./Camera.ts";
import { resolveDimensionAnnotationOffset } from "./dimensionAnnotationOffset.ts";
import { radialDimensionAngle } from "./radialDimensionAngle.ts";

/** Screen-pixel offset of labels from the geometry they annotate. */
export const LABEL_OFFSET_PX = 12;
const LABEL_HEIGHT_PX = 14;
const OVERLAP_PADDING_PX = 2;
const STACK_STEP_PX = 16;
const MAX_STACK_STEPS = 14;

export type PlacedAnnotation = {
  readonly constraintId: ConstraintId;
  readonly text: string;
  readonly screenX: number;
  readonly screenY: number;
  readonly width: number;
  readonly height: number;
  readonly dimension: boolean;
};

type PreferredAnnotation = {
  readonly constraintId: ConstraintId;
  readonly text: string;
  readonly anchor: Point2D;
  /** Preferred unit direction in screen space (y down). */
  readonly offset: Point2D;
  readonly dimension: boolean;
};

export type AnnotationLayoutOptions = {
  /** Live drag overrides (world-mm offsets from each dimension anchor). */
  readonly labelOffsetOverrides?: ReadonlyMap<ConstraintId, Point2D>;
};

/**
 * Compute non-overlapping screen positions for constraint glyphs and dimension
 * labels. Shared by drawing and hit-testing so both stay in sync.
 * Manual `annotation.labelOffset` (or an override) pins the label and skips stacking.
 * Offsets are axis-constrained (H → vertical motion, V → horizontal) before placing.
 */
export function layoutConstraintAnnotations(
  sketch: Sketch,
  camera: Camera,
  measureTextWidth: (text: string) => number,
  options?: AnnotationLayoutOptions,
): readonly PlacedAnnotation[] {
  const preferred: PreferredAnnotation[] = [];
  for (const constraint of sketch.constraints) {
    const item = preferredAnnotation(sketch, constraint);
    if (item !== null) {
      preferred.push(item);
    }
  }

  // Dimensions first (user-visible blue labels), then glyphs — still deconflict both.
  preferred.sort((a, b) => {
    if (a.dimension !== b.dimension) {
      return a.dimension ? -1 : 1;
    }
    return a.constraintId.localeCompare(b.constraintId);
  });

  const placed: PlacedAnnotation[] = [];
  for (const item of preferred) {
    const width = measureTextWidth(item.text) + 6;
    const height = LABEL_HEIGHT_PX;
    const manualOffset = resolveDimensionAnnotationOffset(
      sketch,
      item.constraintId,
      options?.labelOffsetOverrides,
    );
    let screen: Point2D;
    if (manualOffset !== undefined) {
      screen = worldToScreen(
        {
          x: item.anchor.x + manualOffset.x,
          y: item.anchor.y + manualOffset.y,
        },
        camera,
      );
    } else {
      const base = worldToScreen(item.anchor, camera);
      const preferredScreen = {
        x: base.x + item.offset.x * LABEL_OFFSET_PX,
        y: base.y + item.offset.y * LABEL_OFFSET_PX,
      };
      screen = findFreeScreenPosition(
        preferredScreen,
        width,
        height,
        item.offset,
        placed,
      );
    }
    placed.push({
      constraintId: item.constraintId,
      text: item.text,
      screenX: screen.x,
      screenY: screen.y,
      width,
      height,
      dimension: item.dimension,
    });
  }
  return placed;
}

/** World anchor used for dimension label placement (before offset / stacking). */
export function dimensionLabelAnchor(
  sketch: Sketch,
  constraintId: ConstraintId,
): Point2D | null {
  const constraint = sketch.constraints.find((item) => item.id === constraintId);
  if (constraint === undefined) {
    return null;
  }
  return dimensionAnchor(sketch, constraint);
}

function findFreeScreenPosition(
  preferred: Point2D,
  width: number,
  height: number,
  primaryOffset: Point2D,
  placed: readonly PlacedAnnotation[],
): Point2D {
  const primary = normalizeOrFallback(primaryOffset, { x: 0, y: -1 });
  const secondary = { x: -primary.y, y: primary.x };
  const candidates: Point2D[] = [];
  for (let step = 0; step <= MAX_STACK_STEPS; step += 1) {
    const dist = step * STACK_STEP_PX;
    if (step === 0) {
      candidates.push(preferred);
      continue;
    }
    candidates.push({
      x: preferred.x + primary.x * dist,
      y: preferred.y + primary.y * dist,
    });
    candidates.push({
      x: preferred.x - primary.x * dist,
      y: preferred.y - primary.y * dist,
    });
    candidates.push({
      x: preferred.x + secondary.x * dist,
      y: preferred.y + secondary.y * dist,
    });
    candidates.push({
      x: preferred.x - secondary.x * dist,
      y: preferred.y - secondary.y * dist,
    });
  }

  for (const candidate of candidates) {
    if (!overlapsAny(candidate, width, height, placed)) {
      return candidate;
    }
  }
  // Last resort: push far along primary.
  return {
    x: preferred.x + primary.x * (MAX_STACK_STEPS + 1) * STACK_STEP_PX,
    y: preferred.y + primary.y * (MAX_STACK_STEPS + 1) * STACK_STEP_PX,
  };
}

function overlapsAny(
  center: Point2D,
  width: number,
  height: number,
  placed: readonly PlacedAnnotation[],
): boolean {
  const a = bounds(center, width, height);
  for (const other of placed) {
    const b = bounds(
      { x: other.screenX, y: other.screenY },
      other.width,
      other.height,
    );
    if (rectsOverlap(a, b, OVERLAP_PADDING_PX)) {
      return true;
    }
  }
  return false;
}

function bounds(
  center: Point2D,
  width: number,
  height: number,
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - height / 2,
    bottom: center.y + height / 2,
  };
}

function rectsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
  pad: number,
): boolean {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

function normalizeOrFallback(v: Point2D, fallback: Point2D): Point2D {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) {
    return fallback;
  }
  return { x: v.x / len, y: v.y / len };
}

function preferredAnnotation(
  sketch: Sketch,
  constraint: Constraint,
): PreferredAnnotation | null {
  if (constraint.type === "horizontal" || constraint.type === "vertical") {
    const handles = orientationHandles(sketch, constraint.references);
    const a = handles === null ? null : resolveConstraintPoint(sketch, handles[0]);
    const b = handles === null ? null : resolveConstraintPoint(sketch, handles[1]);
    if (a === null || b === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: constraint.type === "horizontal" ? "H" : "V",
      anchor: lineMidpoint(a, b),
      offset: constraint.type === "horizontal" ? { x: 0, y: 1 } : { x: 1, y: 0 },
      dimension: false,
    };
  }

  if (constraint.type === "parallel" || constraint.type === "perpendicular") {
    const point = lineRelationAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: constraint.type === "parallel" ? "//" : "⊥",
      anchor: point,
      offset: { x: 0, y: 1 },
      dimension: false,
    };
  }

  if (constraint.type === "tangent") {
    const point = tangentAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: "T",
      anchor: point,
      offset: { x: 1, y: -1 },
      dimension: false,
    };
  }

  if (constraint.type === "concentric") {
    const point = concentricAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: "◎",
      anchor: point,
      offset: { x: 1, y: -1 },
      dimension: false,
    };
  }

  if (constraint.type === "midpoint") {
    const point = midpointAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: "M",
      anchor: point,
      offset: { x: 0, y: 1 },
      dimension: false,
    };
  }

  if (constraint.type === "equal") {
    const point = equalAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: "=",
      anchor: point,
      offset: { x: 1, y: -1 },
      dimension: false,
    };
  }

  if (constraint.type === "symmetric") {
    const point = symmetricAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: "⇄",
      anchor: point,
      offset: { x: 1, y: -1 },
      dimension: false,
    };
  }

  if (constraint.type === "point-on-object") {
    const point = pointOnObjectAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: "⌇",
      anchor: point,
      offset: { x: 0, y: 1 },
      dimension: false,
    };
  }

  if (constraint.type === "fix") {
    const point = fixAnnotationPoint(sketch, constraint);
    if (point === null) {
      return null;
    }
    return {
      constraintId: constraint.id,
      text: "F",
      anchor: point,
      offset: { x: 1, y: -1 },
      dimension: false,
    };
  }

  if (!isSupportedDimensionType(constraint.type)) {
    return null;
  }
  const measured = measureDimension(sketch, constraint.type, constraint.references);
  const anchor = dimensionAnchor(sketch, constraint);
  if (measured === null || anchor === null) {
    return null;
  }
  const text = formatDimension(constraint, measured);
  return {
    constraintId: constraint.id,
    text: isDrivingConstraint(constraint) ? text : `(${text})`,
    anchor,
    offset: dimensionLabelOffset(sketch, constraint),
    dimension: true,
  };
}

function dimensionLabelOffset(
  sketch: Sketch,
  constraint: Constraint,
): Point2D {
  if (constraint.type === "coordinate-x") {
    return { x: -1.2, y: 0 };
  }
  if (constraint.type === "coordinate-y") {
    return { x: 0, y: -1.2 };
  }
  if (constraint.type === "horizontal-distance") {
    return { x: 0, y: -1.2 };
  }
  if (constraint.type === "vertical-distance") {
    return { x: 1.2, y: 0 };
  }
  if (constraint.type === "radius" || constraint.type === "diameter") {
    const entity = sketch.geometry.find(
      (item) => item.id === constraint.references[0]?.entityId,
    );
    if (entity?.type === "circle" || entity?.type === "arc") {
      const angle = radialDimensionAngle(entity, constraint.id);
      // Offset is screen-space (Y down); world Y-up radial → flip sin.
      return {
        x: Math.cos(angle) * 1.6,
        y: -Math.sin(angle) * 1.6,
      };
    }
  }
  return { x: 0, y: -1.2 };
}

function dimensionAnchor(sketch: Sketch, constraint: Constraint): Point2D | null {
  switch (constraint.type) {
    case "length": {
      const line = referencedLine(sketch, constraint.references[0]);
      return line === null ? null : lineMidpoint(line.start, line.end);
    }
    case "distance": {
      const handles = distanceHandles(sketch, constraint.references);
      const a = handles === null ? null : resolveConstraintPoint(sketch, handles[0]);
      const b = handles === null ? null : resolveConstraintPoint(sketch, handles[1]);
      return a === null || b === null ? null : lineMidpoint(a, b);
    }
    case "horizontal-distance": {
      const handles = distanceHandles(sketch, constraint.references);
      const a = handles === null ? null : resolveConstraintPoint(sketch, handles[0]);
      const b = handles === null ? null : resolveConstraintPoint(sketch, handles[1]);
      if (a === null || b === null) {
        return null;
      }
      // Anchor on the horizontal dim line (above the higher point), not the diagonal chord.
      return { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) };
    }
    case "vertical-distance": {
      const handles = distanceHandles(sketch, constraint.references);
      const a = handles === null ? null : resolveConstraintPoint(sketch, handles[0]);
      const b = handles === null ? null : resolveConstraintPoint(sketch, handles[1]);
      if (a === null || b === null) {
        return null;
      }
      return { x: Math.max(a.x, b.x), y: (a.y + b.y) / 2 };
    }
    case "coordinate-x":
    case "coordinate-y": {
      const point = resolveCoordinatePoint(sketch, constraint.references[0]);
      if (point === null) {
        return null;
      }
      return constraint.type === "coordinate-x"
        ? { x: point.x / 2, y: point.y }
        : { x: point.x, y: point.y / 2 };
    }
    case "radius":
    case "diameter": {
      const entity = sketch.geometry.find(
        (item) => item.id === constraint.references[0]?.entityId,
      );
      if (entity?.type !== "circle" && entity?.type !== "arc") {
        return null;
      }
      return pointOnCircle(
        entity.center,
        entity.radius,
        radialDimensionAngle(entity, constraint.id),
      );
    }
    case "angle": {
      const a = referencedLine(sketch, constraint.references[0]);
      const b = referencedLine(sketch, constraint.references[1]);
      if (a === null || b === null) {
        return null;
      }
      return lineMidpoint(lineMidpoint(a.start, a.end), lineMidpoint(b.start, b.end));
    }
    default:
      return null;
  }
}

function formatDimension(constraint: Constraint, measured: number): string {
  switch (constraint.type) {
    case "radius":
      return `R${measured.toFixed(2)}`;
    case "diameter":
      return `⌀${measured.toFixed(2)}`;
    case "angle":
      return `${((measured * 180) / Math.PI).toFixed(1)}°`;
    case "horizontal-distance":
      return `↔${measured.toFixed(2)}`;
    case "vertical-distance":
      return `↕${measured.toFixed(2)}`;
    case "distance":
      return `⟷${measured.toFixed(2)}`;
    case "coordinate-x":
      return `X ${measured.toFixed(2)}`;
    case "coordinate-y":
      return `Y ${measured.toFixed(2)}`;
    default:
      return measured.toFixed(2);
  }
}
