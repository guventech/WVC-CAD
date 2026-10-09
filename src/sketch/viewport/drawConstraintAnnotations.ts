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
import type { Constraint } from "../model/Constraint.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Camera } from "./Camera.ts";
import { worldToScreen } from "./Camera.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

/** Screen-pixel offset of labels from the geometry they annotate. */
const LABEL_OFFSET_PX = 12;

/**
 * Draw H/V glyphs and dimension labels. View-only: values are measured from
 * the (possibly drag-previewed) sketch, never read back into the model.
 */
export function drawConstraintAnnotations(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sketch: Sketch,
): void {
  ctx.save();
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const constraint of sketch.constraints) {
    const label = annotationFor(sketch, constraint);
    if (label === null) {
      continue;
    }
    const screen = worldToScreen(label.anchor, camera);
    const x = screen.x + label.offset.x * LABEL_OFFSET_PX;
    const y = screen.y + label.offset.y * LABEL_OFFSET_PX;
    const width = ctx.measureText(label.text).width + 6;
    ctx.fillStyle = VIEWPORT_COLORS.background;
    ctx.fillRect(x - width / 2, y - 7, width, 14);
    ctx.fillStyle = label.dimension
      ? VIEWPORT_COLORS.dimension
      : VIEWPORT_COLORS.constraintGlyph;
    ctx.fillText(label.text, x, y);
  }

  ctx.restore();
}

interface Annotation {
  readonly text: string;
  readonly anchor: Point2D;
  /** Unit direction in screen space (y down). */
  readonly offset: Point2D;
  readonly dimension: boolean;
}

function annotationFor(sketch: Sketch, constraint: Constraint): Annotation | null {
  if (constraint.type === "horizontal" || constraint.type === "vertical") {
    const handles = orientationHandles(sketch, constraint.references);
    const a = handles === null ? null : resolveConstraintPoint(sketch, handles[0]);
    const b = handles === null ? null : resolveConstraintPoint(sketch, handles[1]);
    if (a === null || b === null) {
      return null;
    }
    return {
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
    text: isDrivingConstraint(constraint) ? text : `(${text})`,
    anchor,
    offset: dimensionLabelOffset(constraint.type),
    dimension: true,
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
    case "distance":
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
      // Midpoint between the point and its foot on the corresponding axis.
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
