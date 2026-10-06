import { pointOnCircle } from "../geometry/EntityFeatures.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import { assembleSystem } from "../solver/Jacobian.ts";
import { matrixPivotColumns, vecNormInf } from "../solver/LinearAlgebra.ts";
import type { SolverVariable } from "../solver/SolverVariables.ts";
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
  if (sketch.geometry.length === 0 || dof.degreesOfFreedom === 0) {
    return {
      degreesOfFreedom: dof.degreesOfFreedom,
      freeHandles: [],
      summary:
        sketch.geometry.length === 0
          ? "No geometry."
          : "Sketch is fully constrained.",
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
    summary: formatUnderConstrainedSummary(dof.degreesOfFreedom, freeHandles),
  };
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
