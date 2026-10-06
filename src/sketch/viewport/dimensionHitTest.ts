import { resolveConstraintPoint } from "../constraints/ConstraintRef.ts";
import {
  distanceHandles,
  isSupportedDimensionType,
  measureDimension,
  referencedLine,
  resolveCoordinatePoint,
} from "../constraints/Dimensions.ts";
import { lineMidpoint, pointOnCircle } from "../geometry/EntityFeatures.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Camera } from "./Camera.ts";
import { worldToScreen } from "./Camera.ts";

const LABEL_OFFSET_PX = 12;
const HIT_PADDING_PX = 8;

export interface DimensionLabelHit {
  readonly constraintId: ConstraintId;
  readonly screen: Point2D;
  readonly text: string;
}

/**
 * Hit-test dimension labels in screen space (same layout as drawConstraintAnnotations).
 */
export function hitTestDimensionLabel(
  sketch: Sketch,
  worldPoint: Point2D,
  camera: Camera,
  measureTextWidth: (text: string) => number,
): DimensionLabelHit | null {
  const screenCursor = worldToScreen(worldPoint, camera);
  let best: DimensionLabelHit | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const constraint of sketch.constraints) {
    if (!isSupportedDimensionType(constraint.type)) {
      continue;
    }
    const layout = dimensionLabelLayout(sketch, constraint);
    if (layout === null) {
      continue;
    }
    const screen = worldToScreen(layout.anchor, camera);
    const x = screen.x + layout.offset.x * LABEL_OFFSET_PX;
    const y = screen.y + layout.offset.y * LABEL_OFFSET_PX;
    const width = measureTextWidth(layout.text) + 6;
    const height = 14;
    const left = x - width / 2 - HIT_PADDING_PX;
    const right = x + width / 2 + HIT_PADDING_PX;
    const top = y - height / 2 - HIT_PADDING_PX;
    const bottom = y + height / 2 + HIT_PADDING_PX;
    if (
      screenCursor.x < left ||
      screenCursor.x > right ||
      screenCursor.y < top ||
      screenCursor.y > bottom
    ) {
      continue;
    }
    const dist = Math.hypot(screenCursor.x - x, screenCursor.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { constraintId: constraint.id, screen: { x, y }, text: layout.text };
    }
  }

  return best;
}

function dimensionLabelLayout(
  sketch: Sketch,
  constraint: Constraint,
): { readonly text: string; readonly anchor: Point2D; readonly offset: Point2D } | null {
  const measured = measureDimension(sketch, constraint.type, constraint.references);
  const anchor = dimensionAnchor(sketch, constraint);
  if (measured === null || anchor === null) {
    return null;
  }
  const text = formatDimension(constraint, measured);
  return {
    text: isDrivingConstraint(constraint) ? text : `(${text})`,
    anchor,
    offset: dimensionLabelOffset(constraint.type),
  };
}

function dimensionLabelOffset(type: Constraint["type"]): Point2D {
  if (type === "coordinate-x") {
    return { x: -1.2, y: 0 };
  }
  if (type === "coordinate-y") {
    return { x: 0, y: -1.2 };
  }
  return { x: 0, y: -1.2 };
}

function dimensionAnchor(sketch: Sketch, constraint: Constraint): Point2D | null {
  switch (constraint.type) {
    case "length": {
      const line = referencedLine(sketch, constraint.references[0]);
      return line === null ? null : lineMidpoint(line.start, line.end);
    }
    case "horizontal-distance":
    case "vertical-distance": {
      const handles = distanceHandles(sketch, constraint.references);
      const a = handles === null ? null : resolveConstraintPoint(sketch, handles[0]);
      const b = handles === null ? null : resolveConstraintPoint(sketch, handles[1]);
      return a === null || b === null ? null : lineMidpoint(a, b);
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
      return pointOnCircle(entity.center, entity.radius, Math.PI / 4);
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
    case "coordinate-x":
      return `X ${measured.toFixed(2)}`;
    case "coordinate-y":
      return `Y ${measured.toFixed(2)}`;
    default:
      return measured.toFixed(2);
  }
}
