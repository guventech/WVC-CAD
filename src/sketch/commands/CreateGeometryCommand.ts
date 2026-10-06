import {
  angleFromTo,
  distance,
  isApproximatelyEqual,
  normalizeAngle,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type {
  ArcGeometry,
  CircleGeometry,
  EntityId,
  Geometry,
  LineGeometry,
  PointGeometry,
} from "../model/Geometry.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  createHorizontalConstraint,
  createMidpointConstraint,
  createVerticalConstraint,
} from "../constraints/ConstraintFactory.ts";
import type { SketchCommand } from "./Command.ts";

export function createPointGeometry(
  position: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): PointGeometry {
  return {
    id: options?.id ?? createEntityId("point"),
    type: "point",
    position: { x: position.x, y: position.y },
    construction: options?.construction ?? false,
  };
}

export function createLineGeometry(
  start: Point2D,
  end: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): LineGeometry | null {
  if (distance(start, end) <= TOLERANCE.coincidence) {
    return null;
  }

  return {
    id: options?.id ?? createEntityId("line"),
    type: "line",
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    construction: options?.construction ?? false,
  };
}

export function createCircleGeometry(
  center: Point2D,
  radius: number,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): CircleGeometry | null {
  if (!(radius > TOLERANCE.coincidence) || !Number.isFinite(radius)) {
    return null;
  }

  return {
    id: options?.id ?? createEntityId("circle"),
    type: "circle",
    center: { x: center.x, y: center.y },
    radius,
    construction: options?.construction ?? false,
  };
}

export function createCircleGeometryFromPoints(
  center: Point2D,
  radiusPoint: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): CircleGeometry | null {
  return createCircleGeometry(center, distance(center, radiusPoint), options);
}

/**
 * Arc stored as center + radius + CCW sweep from startAngle to endAngle.
 * Rejects non-positive radius and degenerate sweeps (start ≈ end after normalize).
 */
export function createArcGeometry(
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): ArcGeometry | null {
  if (!(radius > TOLERANCE.coincidence) || !Number.isFinite(radius)) {
    return null;
  }
  if (
    !Number.isFinite(startAngle) ||
    !Number.isFinite(endAngle) ||
    isApproximatelyEqual(
      normalizeAngle(startAngle),
      normalizeAngle(endAngle),
      TOLERANCE.geometric,
    )
  ) {
    return null;
  }

  return {
    id: options?.id ?? createEntityId("arc"),
    type: "arc",
    center: { x: center.x, y: center.y },
    radius,
    startAngle,
    endAngle,
    construction: options?.construction ?? false,
  };
}

/** Radius from center→start; end point defines end angle only (projected onto the circle). */
export function createArcGeometryFromPoints(
  center: Point2D,
  startPoint: Point2D,
  endPoint: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): ArcGeometry | null {
  return createArcGeometry(
    center,
    distance(center, startPoint),
    angleFromTo(center, startPoint),
    angleFromTo(center, endPoint),
    options,
  );
}

function addGeometry(sketch: Sketch, geometry: Geometry): Sketch {
  return {
    ...sketch,
    geometry: [...sketch.geometry, geometry],
  };
}

function createAddEntityCommand(
  entity: Geometry,
  label: string,
): SketchCommand {
  return {
    label,
    apply(sketch) {
      if (sketch.geometry.some((existing) => existing.id === entity.id)) {
        return sketch;
      }
      return addGeometry(sketch, entity);
    },
    undo(sketch) {
      return {
        ...sketch,
        geometry: sketch.geometry.filter((existing) => existing.id !== entity.id),
      };
    },
  };
}

export function addPointToSketch(
  sketch: Sketch,
  position: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): { readonly sketch: Sketch; readonly point: PointGeometry } {
  const point = createPointGeometry(position, options);
  return {
    sketch: addGeometry(sketch, point),
    point,
  };
}

export function addLineToSketch(
  sketch: Sketch,
  start: Point2D,
  end: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): { readonly sketch: Sketch; readonly line: LineGeometry } | null {
  const line = createLineGeometry(start, end, options);
  if (line === null) {
    return null;
  }
  return {
    sketch: addGeometry(sketch, line),
    line,
  };
}

export function addCircleToSketch(
  sketch: Sketch,
  center: Point2D,
  radius: number,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): { readonly sketch: Sketch; readonly circle: CircleGeometry } | null {
  const circle = createCircleGeometry(center, radius, options);
  if (circle === null) {
    return null;
  }
  return {
    sketch: addGeometry(sketch, circle),
    circle,
  };
}

export function createAddPointCommand(
  position: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
    /** When set, also add midpoint(point, line). */
    readonly midpointOf?: EntityId;
  },
): SketchCommand {
  const point = createPointGeometry(position, options);
  const midpoint =
    options?.midpointOf !== undefined
      ? createMidpointConstraint(
          createEntityId("constraint"),
          { entityId: point.id, role: "position" },
          options.midpointOf,
        )
      : null;
  const midpointId = midpoint?.id ?? null;

  return {
    label:
      midpoint !== null
        ? `Add point ${point.id} at midpoint`
        : `Add point ${point.id}`,
    apply(sketch) {
      if (sketch.geometry.some((existing) => existing.id === point.id)) {
        return sketch;
      }
      let next = addGeometry(sketch, point);
      if (midpoint !== null) {
        next = {
          ...next,
          constraints: [...next.constraints, midpoint],
        };
      }
      return next;
    },
    undo(sketch) {
      return {
        ...sketch,
        geometry: sketch.geometry.filter((existing) => existing.id !== point.id),
        constraints: sketch.constraints.filter(
          (constraint) =>
            constraint.id !== midpointId &&
            !constraint.references.some((ref) => ref.entityId === point.id),
        ),
      };
    },
  };
}

export function createAddLineCommand(
  start: Point2D,
  end: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
    /** Auto midpoint: new line start ↔ this line. */
    readonly startMidpointOf?: EntityId;
    /** Auto midpoint: new line end ↔ this line. */
    readonly endMidpointOf?: EntityId;
  },
): SketchCommand | null {
  const line = createLineGeometry(start, end, options);
  if (line === null) {
    return null;
  }

  const orientation = detectAxisAlignedOrientation(line);
  const orientationConstraint =
    orientation === "horizontal"
      ? createHorizontalConstraint(createEntityId("constraint"), line.id)
      : orientation === "vertical"
        ? createVerticalConstraint(createEntityId("constraint"), line.id)
        : null;

  const orientationId = orientationConstraint?.id ?? null;
  const midpointConstraints = [
    ...(options?.startMidpointOf !== undefined
      ? [
          createMidpointConstraint(
            createEntityId("constraint"),
            { entityId: line.id, role: "start" },
            options.startMidpointOf,
          ),
        ]
      : []),
    ...(options?.endMidpointOf !== undefined
      ? [
          createMidpointConstraint(
            createEntityId("constraint"),
            { entityId: line.id, role: "end" },
            options.endMidpointOf,
          ),
        ]
      : []),
  ];
  const midpointIds = new Set(midpointConstraints.map((c) => c.id));

  return {
    label:
      orientation === "horizontal"
        ? `Add horizontal line ${line.id}`
        : orientation === "vertical"
          ? `Add vertical line ${line.id}`
          : `Add line ${line.id}`,
    apply(sketch) {
      if (sketch.geometry.some((existing) => existing.id === line.id)) {
        return sketch;
      }
      let next: Sketch = {
        ...sketch,
        geometry: [...sketch.geometry, line],
      };
      const extras = [
        ...(orientationConstraint !== null ? [orientationConstraint] : []),
        ...midpointConstraints,
      ];
      if (extras.length > 0) {
        next = {
          ...next,
          constraints: [...next.constraints, ...extras],
        };
      }
      return next;
    },
    undo(sketch) {
      return {
        ...sketch,
        geometry: sketch.geometry.filter((existing) => existing.id !== line.id),
        constraints: sketch.constraints.filter(
          (constraint) =>
            constraint.id !== orientationId &&
            !midpointIds.has(constraint.id) &&
            !constraint.references.some((ref) => ref.entityId === line.id),
        ),
      };
    },
  };
}

/** Perfect H/V (within coincidence tolerance) → orientation constraint on create. */
export function detectAxisAlignedOrientation(
  line: LineGeometry,
): "horizontal" | "vertical" | null {
  if (isApproximatelyEqual(line.start.y, line.end.y, TOLERANCE.coincidence)) {
    return "horizontal";
  }
  if (isApproximatelyEqual(line.start.x, line.end.x, TOLERANCE.coincidence)) {
    return "vertical";
  }
  return null;
}

export function createAddCircleCommand(
  center: Point2D,
  radiusPoint: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
    /** Auto midpoint: new circle center ↔ this line. */
    readonly centerMidpointOf?: EntityId;
  },
): SketchCommand | null {
  const circle = createCircleGeometryFromPoints(center, radiusPoint, options);
  if (circle === null) {
    return null;
  }
  const midpoint =
    options?.centerMidpointOf !== undefined
      ? createMidpointConstraint(
          createEntityId("constraint"),
          { entityId: circle.id, role: "center" },
          options.centerMidpointOf,
        )
      : null;
  const midpointId = midpoint?.id ?? null;

  return {
    label:
      midpoint !== null
        ? `Add circle ${circle.id} at midpoint`
        : `Add circle ${circle.id}`,
    apply(sketch) {
      if (sketch.geometry.some((existing) => existing.id === circle.id)) {
        return sketch;
      }
      let next = addGeometry(sketch, circle);
      if (midpoint !== null) {
        next = {
          ...next,
          constraints: [...next.constraints, midpoint],
        };
      }
      return next;
    },
    undo(sketch) {
      return {
        ...sketch,
        geometry: sketch.geometry.filter((existing) => existing.id !== circle.id),
        constraints: sketch.constraints.filter(
          (constraint) =>
            constraint.id !== midpointId &&
            !constraint.references.some((ref) => ref.entityId === circle.id),
        ),
      };
    },
  };
}

export function addArcToSketch(
  sketch: Sketch,
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): { readonly sketch: Sketch; readonly arc: ArcGeometry } | null {
  const arc = createArcGeometry(center, radius, startAngle, endAngle, options);
  if (arc === null) {
    return null;
  }
  return {
    sketch: addGeometry(sketch, arc),
    arc,
  };
}

export function createAddArcCommand(
  center: Point2D,
  startPoint: Point2D,
  endPoint: Point2D,
  options?: {
    readonly id?: EntityId;
    readonly construction?: boolean;
  },
): SketchCommand | null {
  const arc = createArcGeometryFromPoints(center, startPoint, endPoint, options);
  if (arc === null) {
    return null;
  }
  return createAddEntityCommand(arc, `Add arc ${arc.id}`);
}
