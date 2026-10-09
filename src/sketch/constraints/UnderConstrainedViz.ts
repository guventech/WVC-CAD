import { pointOnCircle } from "../geometry/EntityFeatures.ts";
import {
  isApproximatelyEqual,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import type { EntityId, Geometry, LineGeometry } from "../model/Geometry.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import type { Sketch } from "../model/Sketch.ts";
import { assembleSystem } from "../solver/Jacobian.ts";
import { matrixPivotColumns, vecNormInf } from "../solver/LinearAlgebra.ts";
import type { SolverVariable } from "../solver/SolverVariables.ts";
import { buildCoincidentClusters } from "./Coincident.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";

export type FreeHandleRole = "position" | "start" | "end" | "center" | "radius";

/** One user-visible free handle derived from free Jacobian columns. */
export interface FreeHandle {
  readonly entityId: EntityId;
  readonly role: FreeHandleRole;
  /** World position where the DOF marker is drawn. */
  readonly point: Point2D;
  readonly freeX: boolean;
  readonly freeY: boolean;
  readonly freeRadius: boolean;
}

export interface UnderConstrainedVisualization {
  readonly degreesOfFreedom: number;
  readonly freeHandles: readonly FreeHandle[];
  /**
   * Geometry entities whose body is fixed in the plane (CAD “green” stroke).
   * Free Jacobian columns expand through coincident clusters and rectangle
   * corner↔edge topology. Length-only freedom on an otherwise fixed H/V edge
   * does not un-green that edge (top can move while left/right stay green).
   */
  readonly fullyConstrainedEntityIds: ReadonlySet<EntityId>;
  /** Short engineering sentence for panel / status tooltip. */
  readonly summary: string;
}

/**
 * Map free Jacobian columns onto geometry handles for under-constrained viz.
 * Datums never appear (they are not solver variables).
 */
export function analyzeUnderConstrainedVisualization(
  sketch: Sketch,
): UnderConstrainedVisualization {
  const dof = analyzeDegreesOfFreedom(sketch);
  if (sketch.geometry.length === 0) {
    return {
      degreesOfFreedom: dof.degreesOfFreedom,
      freeHandles: [],
      fullyConstrainedEntityIds: new Set(),
      summary: "No geometry.",
    };
  }
  if (dof.degreesOfFreedom === 0) {
    return {
      degreesOfFreedom: 0,
      freeHandles: [],
      fullyConstrainedEntityIds: new Set(
        sketch.geometry.map((entity) => entity.id),
      ),
      summary: "Sketch is fully constrained.",
    };
  }

  const assembled = assembleSystem(sketch);
  const { variables } = assembled.system;
  const freeIndices = freeVariableIndices(
    assembled.residual.length,
    variables.length,
    assembled.jacobian,
  );

  const freeVars = freeIndices.map((index) => variables[index]!);
  const freeHandles = groupFreeHandles(sketch, freeVars);
  return {
    degreesOfFreedom: dof.degreesOfFreedom,
    freeHandles,
    fullyConstrainedEntityIds: fullyConstrainedEntityIdsFromVariables(
      sketch,
      variables,
      freeVars,
    ),
    summary: formatUnderConstrainedSummary(dof.degreesOfFreedom, freeHandles),
  };
}

type HandleFreedom = {
  freeX: boolean;
  freeY: boolean;
  freeRadius: boolean;
};

const NO_FREEDOM: HandleFreedom = {
  freeX: false,
  freeY: false,
  freeRadius: false,
};

/**
 * Entities that participate in the solver and whose body cannot move under
 * remaining DOF (length-only change on a fixed H/V supporting line is OK).
 */
function fullyConstrainedEntityIdsFromVariables(
  sketch: Sketch,
  variables: readonly SolverVariable[],
  freeVars: readonly SolverVariable[],
): Set<EntityId> {
  const freedoms = expandHandleFreedoms(sketch, freeVars);
  const entityIdsWithVars = new Set(
    variables.map((variable) => variable.entityId),
  );
  const fullyConstrained = new Set<EntityId>();
  for (const entity of sketch.geometry) {
    if (
      entityIdsWithVars.has(entity.id) &&
      !entityHasBodyFreedom(entity, freedoms)
    ) {
      fullyConstrained.add(entity.id);
    }
  }
  return fullyConstrained;
}

function handleKey(entityId: string, role: string): string {
  return `${entityId}:${role}`;
}

function mergeFreedom(into: HandleFreedom, add: HandleFreedom): boolean {
  const nextX = into.freeX || add.freeX;
  const nextY = into.freeY || add.freeY;
  const nextR = into.freeRadius || add.freeRadius;
  if (
    nextX === into.freeX &&
    nextY === into.freeY &&
    nextR === into.freeRadius
  ) {
    return false;
  }
  into.freeX = nextX;
  into.freeY = nextY;
  into.freeRadius = nextR;
  return true;
}

/** Propagate free axes through coincident clusters and rectangle corner topology. */
function expandHandleFreedoms(
  sketch: Sketch,
  freeVars: readonly SolverVariable[],
): Map<string, HandleFreedom> {
  const freedoms = new Map<string, HandleFreedom>();
  const ensure = (key: string): HandleFreedom => {
    const existing = freedoms.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created: HandleFreedom = { ...NO_FREEDOM };
    freedoms.set(key, created);
    return created;
  };

  for (const variable of freeVars) {
    const mapped = mapVariableToHandle(variable);
    if (mapped === null) {
      continue;
    }
    const slot = ensure(handleKey(mapped.entityId, mapped.role));
    if (mapped.axis === "x") {
      slot.freeX = true;
    } else if (mapped.axis === "y") {
      slot.freeY = true;
    } else {
      slot.freeRadius = true;
    }
  }

  const clusters = buildCoincidentClusters(sketch);
  const topologyPairs = rectangleTopologyHandlePairs(sketch);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, freedom] of [...freedoms.entries()]) {
      if (!freedom.freeX && !freedom.freeY && !freedom.freeRadius) {
        continue;
      }
      const sep = key.lastIndexOf(":");
      const role = key.slice(sep + 1);
      if (role === "radius") {
        continue;
      }
      const ref: ConstraintReference = {
        entityId: key.slice(0, sep),
        role: role as ConstraintReference["role"],
      };
      for (const member of clusters.membersOf(ref)) {
        if (
          mergeFreedom(ensure(handleKey(member.entityId, member.role)), freedom)
        ) {
          changed = true;
        }
      }
    }
    for (const [a, b] of topologyPairs) {
      const fa = freedoms.get(handleKey(a.entityId, a.role));
      const fb = freedoms.get(handleKey(b.entityId, b.role));
      if (fa !== undefined) {
        if (mergeFreedom(ensure(handleKey(b.entityId, b.role)), fa)) {
          changed = true;
        }
      }
      if (fb !== undefined) {
        if (mergeFreedom(ensure(handleKey(a.entityId, a.role)), fb)) {
          changed = true;
        }
      }
    }
  }

  return freedoms;
}

function rectangleTopologyHandlePairs(
  sketch: Sketch,
): readonly (readonly [ConstraintReference, ConstraintReference])[] {
  const pairs: [ConstraintReference, ConstraintReference][] = [];
  for (const constraint of sketch.constraints) {
    const feature = parseRectangleFeature(constraint);
    if (feature === null) {
      continue;
    }
    if (
      feature.corners.bl === null ||
      feature.corners.br === null ||
      feature.corners.tr === null ||
      feature.corners.tl === null
    ) {
      continue;
    }
    const links: readonly (readonly [EntityId, EntityId, "start" | "end"])[] = [
      [feature.corners.bl, feature.edges.bottom, "start"],
      [feature.corners.br, feature.edges.bottom, "end"],
      [feature.corners.br, feature.edges.right, "start"],
      [feature.corners.tr, feature.edges.right, "end"],
      [feature.corners.tr, feature.edges.top, "start"],
      [feature.corners.tl, feature.edges.top, "end"],
      [feature.corners.tl, feature.edges.left, "start"],
      [feature.corners.bl, feature.edges.left, "end"],
    ];
    for (const [cornerId, edgeId, which] of links) {
      pairs.push([
        { entityId: cornerId, role: "position" },
        { entityId: edgeId, role: which },
      ]);
    }
  }
  return pairs;
}

/** True when the entity can still leave its supporting place / size meaningfully. */
function entityHasBodyFreedom(
  entity: Geometry,
  freedoms: ReadonlyMap<string, HandleFreedom>,
): boolean {
  switch (entity.type) {
    case "point": {
      const f = freedoms.get(handleKey(entity.id, "position")) ?? NO_FREEDOM;
      return f.freeX || f.freeY;
    }
    case "line":
      return lineHasBodyFreedom(entity, freedoms);
    case "circle":
    case "arc": {
      const center = freedoms.get(handleKey(entity.id, "center")) ?? NO_FREEDOM;
      const radius = freedoms.get(handleKey(entity.id, "radius")) ?? NO_FREEDOM;
      return center.freeX || center.freeY || radius.freeRadius;
    }
  }
}

function lineHasBodyFreedom(
  line: LineGeometry,
  freedoms: ReadonlyMap<string, HandleFreedom>,
): boolean {
  const start = freedoms.get(handleKey(line.id, "start")) ?? NO_FREEDOM;
  const end = freedoms.get(handleKey(line.id, "end")) ?? NO_FREEDOM;
  const orientation = lineBodyOrientation(line);
  if (orientation === "horizontal") {
    // Perpendicular (Y) freedom moves the edge; both ends free in X can slide.
    if (start.freeY || end.freeY) {
      return true;
    }
    return start.freeX && end.freeX;
  }
  if (orientation === "vertical") {
    if (start.freeX || end.freeX) {
      return true;
    }
    return start.freeY && end.freeY;
  }
  return start.freeX || start.freeY || end.freeX || end.freeY;
}

function lineBodyOrientation(
  line: LineGeometry,
): "horizontal" | "vertical" | "diagonal" {
  if (isApproximatelyEqual(line.start.y, line.end.y, TOLERANCE.coincidence)) {
    return "horizontal";
  }
  if (isApproximatelyEqual(line.start.x, line.end.x, TOLERANCE.coincidence)) {
    return "vertical";
  }
  return "diagonal";
}

export function formatUnderConstrainedSummary(
  degreesOfFreedom: number,
  freeHandles: readonly FreeHandle[],
): string {
  if (degreesOfFreedom <= 0) {
    return "Sketch is fully constrained.";
  }
  if (freeHandles.length === 0) {
    return `${degreesOfFreedom} DOF remain (no free handles to highlight).`;
  }

  let freeXY = 0;
  let freeXOnly = 0;
  let freeYOnly = 0;
  let freeRadius = 0;
  for (const handle of freeHandles) {
    if (handle.freeRadius) {
      freeRadius += 1;
    }
    if (handle.freeX && handle.freeY) {
      freeXY += 1;
    } else if (handle.freeX) {
      freeXOnly += 1;
    } else if (handle.freeY) {
      freeYOnly += 1;
    }
  }

  const parts: string[] = [];
  if (freeXY > 0) {
    parts.push(
      `${freeXY} handle${freeXY === 1 ? "" : "s"} can still move freely`,
    );
  }
  if (freeXOnly > 0) {
    parts.push(
      `${freeXOnly} handle${freeXOnly === 1 ? "" : "s"} free horizontally`,
    );
  }
  if (freeYOnly > 0) {
    parts.push(
      `${freeYOnly} handle${freeYOnly === 1 ? "" : "s"} free vertically`,
    );
  }
  if (freeRadius > 0) {
    parts.push(`${freeRadius} radius${freeRadius === 1 ? "" : "es"} still free`);
  }

  const detail = parts.length > 0 ? parts.join("; ") : "remaining free motion";
  return `${degreesOfFreedom} DOF — ${detail}. Drag amber markers.`;
}

function freeVariableIndices(
  equationCount: number,
  variableCount: number,
  jacobian: readonly number[],
): number[] {
  if (variableCount === 0) {
    return [];
  }
  if (equationCount === 0) {
    return Array.from({ length: variableCount }, (_, index) => index);
  }

  const scale = Math.max(1, vecNormInf(jacobian));
  const { pivotColumns } = matrixPivotColumns(
    equationCount,
    variableCount,
    jacobian,
    TOLERANCE.solverResidual * scale,
  );
  const pivot = new Set(pivotColumns);
  const free: number[] = [];
  for (let index = 0; index < variableCount; index += 1) {
    if (!pivot.has(index)) {
      free.push(index);
    }
  }
  return free;
}

function groupFreeHandles(
  sketch: Sketch,
  freeVars: readonly SolverVariable[],
): FreeHandle[] {
  type Acc = {
    role: FreeHandleRole;
    freeX: boolean;
    freeY: boolean;
    freeRadius: boolean;
  };
  const byKey = new Map<string, Acc>();

  for (const variable of freeVars) {
    const mapped = mapVariableToHandle(variable);
    if (mapped === null) {
      continue;
    }
    const key = `${mapped.entityId}:${mapped.role}`;
    const existing = byKey.get(key) ?? {
      role: mapped.role,
      freeX: false,
      freeY: false,
      freeRadius: false,
    };
    if (mapped.axis === "x") {
      existing.freeX = true;
    } else if (mapped.axis === "y") {
      existing.freeY = true;
    } else {
      existing.freeRadius = true;
    }
    byKey.set(key, existing);
  }

  const handles: FreeHandle[] = [];
  for (const [key, acc] of byKey) {
    const entityId = key.slice(0, key.lastIndexOf(":"));
    const point = resolveHandlePoint(sketch, entityId, acc.role);
    if (point === null) {
      continue;
    }
    handles.push({
      entityId,
      role: acc.role,
      point,
      freeX: acc.freeX,
      freeY: acc.freeY,
      freeRadius: acc.freeRadius,
    });
  }

  handles.sort((a, b) => {
    const id = a.entityId.localeCompare(b.entityId);
    return id !== 0 ? id : a.role.localeCompare(b.role);
  });
  return handles;
}

function mapVariableToHandle(
  variable: SolverVariable,
): { entityId: string; role: FreeHandleRole; axis: "x" | "y" | "radius" } | null {
  switch (variable.component) {
    case "x":
      return { entityId: variable.entityId, role: "position", axis: "x" };
    case "y":
      return { entityId: variable.entityId, role: "position", axis: "y" };
    case "startX":
      return { entityId: variable.entityId, role: "start", axis: "x" };
    case "startY":
      return { entityId: variable.entityId, role: "start", axis: "y" };
    case "endX":
      return { entityId: variable.entityId, role: "end", axis: "x" };
    case "endY":
      return { entityId: variable.entityId, role: "end", axis: "y" };
    case "centerX":
      return { entityId: variable.entityId, role: "center", axis: "x" };
    case "centerY":
      return { entityId: variable.entityId, role: "center", axis: "y" };
    case "radius":
      return { entityId: variable.entityId, role: "radius", axis: "radius" };
  }
}

function resolveHandlePoint(
  sketch: Sketch,
  entityId: string,
  role: FreeHandleRole,
): Point2D | null {
  const entity = sketch.geometry.find((item) => item.id === entityId);
  if (entity === undefined) {
    return null;
  }
  switch (role) {
    case "position":
      return entity.type === "point" ? entity.position : null;
    case "start":
      return entity.type === "line" ? entity.start : null;
    case "end":
      return entity.type === "line" ? entity.end : null;
    case "center":
      return entity.type === "circle" || entity.type === "arc"
        ? entity.center
        : null;
    case "radius":
      if (entity.type === "circle") {
        return pointOnCircle(entity.center, entity.radius, 0);
      }
      if (entity.type === "arc") {
        return pointOnCircle(entity.center, entity.radius, entity.startAngle);
      }
      return null;
  }
}
