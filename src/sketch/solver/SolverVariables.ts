import type { PositionAnchor } from "../constraints/Coincident.ts";
import { normalizePointLikeRef } from "../constraints/ConstraintRef.ts";
import type { Geometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import { syncFilletArcAngles } from "../geometry/FilletTopology.ts";

/** One scalar unknown in the solver parameter vector. */
export interface SolverVariable {
  readonly key: string;
  readonly entityId: string;
  readonly component:
    | "x"
    | "y"
    | "startX"
    | "startY"
    | "endX"
    | "endY"
    | "centerX"
    | "centerY"
    | "radius";
}

export interface VariableSystem {
  readonly variables: readonly SolverVariable[];
  readonly values: number[];
  /** Keys that are held fixed (drag anchors). */
  readonly fixedKeys: ReadonlySet<string>;
}

/**
 * Build the free parameter vector for a sketch.
 * Anchored handles contribute no free variables — their geometry stays put.
 */
export function buildVariableSystem(
  sketch: Sketch,
  anchors: readonly PositionAnchor[] = [],
): VariableSystem {
  const fixedKeys = fixedKeysFromAnchors(sketch, anchors);
  const variables: SolverVariable[] = [];
  const values: number[] = [];

  for (const entity of sketch.geometry) {
    switch (entity.type) {
      case "point":
        pushIfFree(variables, values, fixedKeys, {
          key: `point:${entity.id}:x`,
          entityId: entity.id,
          component: "x",
          value: entity.position.x,
        });
        pushIfFree(variables, values, fixedKeys, {
          key: `point:${entity.id}:y`,
          entityId: entity.id,
          component: "y",
          value: entity.position.y,
        });
        break;
      case "line":
        pushIfFree(variables, values, fixedKeys, {
          key: `line:${entity.id}:startX`,
          entityId: entity.id,
          component: "startX",
          value: entity.start.x,
        });
        pushIfFree(variables, values, fixedKeys, {
          key: `line:${entity.id}:startY`,
          entityId: entity.id,
          component: "startY",
          value: entity.start.y,
        });
        pushIfFree(variables, values, fixedKeys, {
          key: `line:${entity.id}:endX`,
          entityId: entity.id,
          component: "endX",
          value: entity.end.x,
        });
        pushIfFree(variables, values, fixedKeys, {
          key: `line:${entity.id}:endY`,
          entityId: entity.id,
          component: "endY",
          value: entity.end.y,
        });
        break;
      case "circle":
      case "arc":
        pushIfFree(variables, values, fixedKeys, {
          key: `${entity.type}:${entity.id}:centerX`,
          entityId: entity.id,
          component: "centerX",
          value: entity.center.x,
        });
        pushIfFree(variables, values, fixedKeys, {
          key: `${entity.type}:${entity.id}:centerY`,
          entityId: entity.id,
          component: "centerY",
          value: entity.center.y,
        });
        pushIfFree(variables, values, fixedKeys, {
          key: `${entity.type}:${entity.id}:radius`,
          entityId: entity.id,
          component: "radius",
          value: entity.radius,
        });
        break;
    }
  }

  return { variables, values, fixedKeys };
}

/** Write free parameters back onto a copy of the sketch geometry. */
export function applyVariables(
  sketch: Sketch,
  system: VariableSystem,
  values: readonly number[],
): Sketch {
  const byEntity = new Map<string, number[]>();
  for (let i = 0; i < system.variables.length; i += 1) {
    const variable = system.variables[i]!;
    const list = byEntity.get(variable.entityId) ?? [];
    list.push(i);
    byEntity.set(variable.entityId, list);
  }

  const geometry = sketch.geometry.map((entity) => {
    const indices = byEntity.get(entity.id);
    if (indices === undefined) {
      return entity;
    }
    return applyEntityVariables(entity, system.variables, values, indices);
  });

  return syncFilletArcAngles({ ...sketch, geometry });
}

function applyEntityVariables(
  entity: Geometry,
  variables: readonly SolverVariable[],
  values: readonly number[],
  indices: readonly number[],
): Geometry {
  let next = entity;
  for (const index of indices) {
    const variable = variables[index]!;
    const value = values[index]!;
    next = writeComponent(next, variable.component, value);
  }
  return next;
}

function writeComponent(
  entity: Geometry,
  component: SolverVariable["component"],
  value: number,
): Geometry {
  switch (entity.type) {
    case "point":
      if (component === "x") {
        return { ...entity, position: { x: value, y: entity.position.y } };
      }
      if (component === "y") {
        return { ...entity, position: { x: entity.position.x, y: value } };
      }
      return entity;
    case "line":
      if (component === "startX") {
        return { ...entity, start: { x: value, y: entity.start.y } };
      }
      if (component === "startY") {
        return { ...entity, start: { x: entity.start.x, y: value } };
      }
      if (component === "endX") {
        return { ...entity, end: { x: value, y: entity.end.y } };
      }
      if (component === "endY") {
        return { ...entity, end: { x: entity.end.x, y: value } };
      }
      return entity;
    case "circle":
    case "arc":
      if (component === "centerX") {
        return { ...entity, center: { x: value, y: entity.center.y } };
      }
      if (component === "centerY") {
        return { ...entity, center: { x: entity.center.x, y: value } };
      }
      if (component === "radius") {
        // Floor only; geometryIsValid remains the authoritative degenerate gate.
        // A step that hits this clamp is treated as near-zero radius and will
        // fail validity / satisfaction rather than silently invent a solution.
        return { ...entity, radius: Math.max(value, 1e-9) };
      }
      return entity;
  }
}

function pushIfFree(
  variables: SolverVariable[],
  values: number[],
  fixedKeys: ReadonlySet<string>,
  entry: SolverVariable & { readonly value: number },
): void {
  if (fixedKeys.has(entry.key)) {
    return;
  }
  variables.push({
    key: entry.key,
    entityId: entry.entityId,
    component: entry.component,
  });
  values.push(entry.value);
}

function fixedKeysFromAnchors(
  sketch: Sketch,
  anchors: readonly PositionAnchor[],
): Set<string> {
  const keys = new Set<string>();
  for (const anchor of anchors) {
    const ref = normalizePointLikeRef(sketch, anchor.ref);
    const entity = sketch.geometry.find((item) => item.id === ref.entityId);
    if (entity === undefined) {
      continue;
    }
    switch (entity.type) {
      case "point":
        keys.add(`point:${entity.id}:x`);
        keys.add(`point:${entity.id}:y`);
        break;
      case "line":
        if (ref.role === "start") {
          keys.add(`line:${entity.id}:startX`);
          keys.add(`line:${entity.id}:startY`);
        } else if (ref.role === "end") {
          keys.add(`line:${entity.id}:endX`);
          keys.add(`line:${entity.id}:endY`);
        }
        break;
      case "circle":
        keys.add(`circle:${entity.id}:centerX`);
        keys.add(`circle:${entity.id}:centerY`);
        break;
      case "arc":
        keys.add(`arc:${entity.id}:centerX`);
        keys.add(`arc:${entity.id}:centerY`);
        break;
    }
  }
  return keys;
}
