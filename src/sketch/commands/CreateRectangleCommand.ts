import {
  createCoincidentConstraint,
  createHorizontalConstraint,
  createRectangleFeatureConstraint,
  createVerticalConstraint,
} from "../constraints/ConstraintFactory.ts";
import { axisAlignedCornersFromDiagonal } from "../geometry/RectangleMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint } from "../model/Constraint.ts";
import { createEntityId } from "../model/EntityId.ts";
import type {
  EntityId,
  LineGeometry,
  PointGeometry,
} from "../model/Geometry.ts";
import type { SketchCommand } from "./Command.ts";
import { createLineGeometry, createPointGeometry } from "./CreateGeometryCommand.ts";

export interface CreatedRectangle {
  readonly corners: {
    readonly bl: PointGeometry;
    readonly br: PointGeometry;
    readonly tr: PointGeometry;
    readonly tl: PointGeometry;
  };
  readonly edges: {
    readonly bottom: LineGeometry;
    readonly right: LineGeometry;
    readonly top: LineGeometry;
    readonly left: LineGeometry;
  };
  readonly constraints: readonly Constraint[];
}

function buildRectangleEntities(
  cornerA: Point2D,
  cornerB: Point2D,
  options?: {
    readonly construction?: boolean;
    readonly idPrefix?: string;
  },
): CreatedRectangle | null {
  const corners = axisAlignedCornersFromDiagonal(cornerA, cornerB);
  if (corners === null) {
    return null;
  }

  const construction = options?.construction ?? false;
  const prefix = options?.idPrefix;

  const bl = createPointGeometry(corners.bl, {
    id: prefix ? `${prefix}-bl` : undefined,
    construction,
  });
  const br = createPointGeometry(corners.br, {
    id: prefix ? `${prefix}-br` : undefined,
    construction,
  });
  const tr = createPointGeometry(corners.tr, {
    id: prefix ? `${prefix}-tr` : undefined,
    construction,
  });
  const tl = createPointGeometry(corners.tl, {
    id: prefix ? `${prefix}-tl` : undefined,
    construction,
  });

  const bottom = createLineGeometry(corners.bl, corners.br, {
    id: prefix ? `${prefix}-bottom` : undefined,
    construction,
  });
  const right = createLineGeometry(corners.br, corners.tr, {
    id: prefix ? `${prefix}-right` : undefined,
    construction,
  });
  const top = createLineGeometry(corners.tr, corners.tl, {
    id: prefix ? `${prefix}-top` : undefined,
    construction,
  });
  const left = createLineGeometry(corners.tl, corners.bl, {
    id: prefix ? `${prefix}-left` : undefined,
    construction,
  });

  if (bottom === null || right === null || top === null || left === null) {
    return null;
  }

  const constraints = buildRectangleConstraints(
    { bl, br, tr, tl },
    { bottom, right, top, left },
    prefix,
  );

  return {
    corners: { bl, br, tr, tl },
    edges: { bottom, right, top, left },
    constraints,
  };
}

export function createAddRectangleCommand(
  cornerA: Point2D,
  cornerB: Point2D,
  options?: {
    readonly construction?: boolean;
  },
): SketchCommand | null {
  const created = buildRectangleEntities(cornerA, cornerB, options);
  if (created === null) {
    return null;
  }

  const geometryIds = new Set<EntityId>([
    created.corners.bl.id,
    created.corners.br.id,
    created.corners.tr.id,
    created.corners.tl.id,
    created.edges.bottom.id,
    created.edges.right.id,
    created.edges.top.id,
    created.edges.left.id,
  ]);
  const constraintIds = new Set(created.constraints.map((item) => item.id));

  return {
    label: `Add rectangle ${created.corners.bl.id}`,
    apply(sketch) {
      if (sketch.geometry.some((entity) => geometryIds.has(entity.id))) {
        return sketch;
      }
      return {
        ...sketch,
        geometry: [
          ...sketch.geometry,
          created.corners.bl,
          created.corners.br,
          created.corners.tr,
          created.corners.tl,
          created.edges.bottom,
          created.edges.right,
          created.edges.top,
          created.edges.left,
        ],
        constraints: [...sketch.constraints, ...created.constraints],
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

function buildRectangleConstraints(
  corners: CreatedRectangle["corners"],
  edges: CreatedRectangle["edges"],
  prefix?: string,
): Constraint[] {
  const id = (label: string) =>
    prefix ? `${prefix}-${label}` : createEntityId("constraint");

  const rectangle = createRectangleFeatureConstraint(id("rectangle"), [
    { entityId: corners.bl.id, role: "corner-bl" },
    { entityId: corners.br.id, role: "corner-br" },
    { entityId: corners.tr.id, role: "corner-tr" },
    { entityId: corners.tl.id, role: "corner-tl" },
    { entityId: edges.bottom.id, role: "edge-bottom" },
    { entityId: edges.right.id, role: "edge-right" },
    { entityId: edges.top.id, role: "edge-top" },
    { entityId: edges.left.id, role: "edge-left" },
  ]);

  // Four corner coincidences between adjacent edge endpoints (AGENTS Chunk 5).
  return [
    rectangle,
    createHorizontalConstraint(id("h-bottom"), edges.bottom.id),
    createHorizontalConstraint(id("h-top"), edges.top.id),
    createVerticalConstraint(id("v-left"), edges.left.id),
    createVerticalConstraint(id("v-right"), edges.right.id),
    createCoincidentConstraint(
      id("c-br"),
      { entityId: edges.bottom.id, role: "end" },
      { entityId: edges.right.id, role: "start" },
    ),
    createCoincidentConstraint(
      id("c-tr"),
      { entityId: edges.right.id, role: "end" },
      { entityId: edges.top.id, role: "start" },
    ),
    createCoincidentConstraint(
      id("c-tl"),
      { entityId: edges.top.id, role: "end" },
      { entityId: edges.left.id, role: "start" },
    ),
    createCoincidentConstraint(
      id("c-bl"),
      { entityId: edges.left.id, role: "end" },
      { entityId: edges.bottom.id, role: "start" },
    ),
  ];
}
