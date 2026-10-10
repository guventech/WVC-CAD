import {
  createCoincidentConstraint,
  createEqualConstraint,
} from "../constraints/ConstraintFactory.ts";
import {
  clampPolygonSides,
  DEFAULT_POLYGON_SIDES,
  regularPolygonVertices,
} from "../geometry/PolygonMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint } from "../model/Constraint.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { EntityId, LineGeometry, PointGeometry } from "../model/Geometry.ts";
import type { SketchCommand } from "./Command.ts";
import {
  createLineGeometry,
  createPointGeometry,
} from "./CreateGeometryCommand.ts";

export function createAddPolygonCommand(
  center: Point2D,
  radiusPoint: Point2D,
  options?: {
    readonly sides?: number;
    readonly construction?: boolean;
  },
): SketchCommand | null {
  const sides = clampPolygonSides(options?.sides ?? DEFAULT_POLYGON_SIDES);
  const vertices = regularPolygonVertices(center, radiusPoint, sides);
  if (vertices === null) {
    return null;
  }
  const construction = options?.construction ?? false;
  const points: PointGeometry[] = [];
  const edges: LineGeometry[] = [];
  const constraints: Constraint[] = [];

  for (let i = 0; i < sides; i += 1) {
    const point = createPointGeometry(vertices[i]!, {
      construction,
      id: createEntityId("point"),
    });
    points.push(point);
  }

  for (let i = 0; i < sides; i += 1) {
    const next = (i + 1) % sides;
    const line = createLineGeometry(vertices[i]!, vertices[next]!, {
      construction,
      id: createEntityId("line"),
    });
    if (line === null) {
      return null;
    }
    edges.push(line);
    constraints.push(
      createCoincidentConstraint(
        createEntityId("constraint"),
        { entityId: points[i]!.id, role: "position" },
        { entityId: line.id, role: "start" },
      ),
      createCoincidentConstraint(
        createEntityId("constraint"),
        { entityId: points[next]!.id, role: "position" },
        { entityId: line.id, role: "end" },
      ),
    );
  }

  for (let i = 1; i < sides; i += 1) {
    constraints.push(
      createEqualConstraint(
        createEntityId("constraint"),
        edges[0]!.id,
        edges[i]!.id,
      ),
    );
  }

  const geometryIds = new Set<EntityId>([
    ...points.map((p) => p.id),
    ...edges.map((e) => e.id),
  ]);
  const constraintIds = new Set(constraints.map((c) => c.id));

  return {
    label: `Add polygon (${sides})`,
    apply(sketch) {
      if (sketch.geometry.some((entity) => geometryIds.has(entity.id))) {
        return sketch;
      }
      return {
        ...sketch,
        geometry: [...sketch.geometry, ...points, ...edges],
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
