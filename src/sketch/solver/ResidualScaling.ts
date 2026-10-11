import type { ConstraintType } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { ResidualEquation } from "./Residuals.ts";

/**
 * Residual / Jacobian row scaling (ADR-052).
 *
 * Length residuals are in mm; angle residuals are in radians; some geometric
 * residuals are already dimensionless. Positive row weights do not change
 * Jacobian rank (DOF honesty preserved) but improve LM conditioning when
 * mixed units share one F(X) vector.
 */

export type ResidualKind = "length" | "angle" | "unitless";

export function residualKindForConstraintType(
  type: ConstraintType | undefined,
): ResidualKind {
  if (type === undefined) {
    return "length";
  }
  switch (type) {
    case "angle":
      return "angle";
    case "parallel":
    case "perpendicular":
      // Already normalized by segment length in the residual.
      return "unitless";
    case "horizontal":
    case "vertical":
      // Endpoint Δx/Δy residuals are millimetres.
      return "length";
    default:
      return "length";
  }
}

/** Characteristic length (mm) from geometry extents; floor 1 mm. */
export function characteristicLengthMm(sketch: Sketch): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  const consider = (x: number, y: number) => {
    any = true;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const entity of sketch.geometry) {
    switch (entity.type) {
      case "point":
        consider(entity.position.x, entity.position.y);
        break;
      case "line":
        consider(entity.start.x, entity.start.y);
        consider(entity.end.x, entity.end.y);
        break;
      case "circle":
      case "arc":
        consider(entity.center.x - entity.radius, entity.center.y);
        consider(entity.center.x + entity.radius, entity.center.y);
        consider(entity.center.x, entity.center.y - entity.radius);
        consider(entity.center.x, entity.center.y + entity.radius);
        break;
      default:
        break;
    }
  }

  if (!any) {
    return 1;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY);
  return Math.max(1, diag);
}

export function residualRowWeights(
  equations: readonly ResidualEquation[],
  sketch: Sketch,
): number[] {
  const byId = new Map(sketch.constraints.map((c) => [c.id, c.type] as const));
  const lengthScale = 1 / characteristicLengthMm(sketch);
  return equations.map((equation) => {
    const kind = residualKindForConstraintType(byId.get(equation.constraintId));
    switch (kind) {
      case "length":
        return lengthScale;
      case "angle":
        // Radians are already O(1); use the same 1/L weight as lengths so a
        // ~1 rad error is not L× stronger than a ~1 mm error in LM.
        return lengthScale;
      case "unitless":
        return 1;
    }
  });
}

/** Per-variable column scales for LM (invertible diagonal). */
export function variableColumnScales(values: readonly number[]): number[] {
  return values.map((value) => Math.max(1, Math.abs(value)));
}

export function scaleResidualRows(
  residual: readonly number[],
  weights: readonly number[],
): number[] {
  return residual.map((value, index) => value * (weights[index] ?? 1));
}

export function scaleJacobianRows(
  jacobian: readonly number[],
  residualCount: number,
  variableCount: number,
  weights: readonly number[],
): number[] {
  const out = jacobian.slice();
  for (let i = 0; i < residualCount; i += 1) {
    const weight = weights[i] ?? 1;
    if (weight === 1) {
      continue;
    }
    const row = i * variableCount;
    for (let j = 0; j < variableCount; j += 1) {
      out[row + j]! *= weight;
    }
  }
  return out;
}

/** J_scaled = J * C (column scales). */
export function scaleJacobianColumns(
  jacobian: readonly number[],
  residualCount: number,
  variableCount: number,
  columnScales: readonly number[],
): number[] {
  const out = jacobian.slice();
  for (let j = 0; j < variableCount; j += 1) {
    const scale = columnScales[j] ?? 1;
    if (scale === 1) {
      continue;
    }
    for (let i = 0; i < residualCount; i += 1) {
      out[i * variableCount + j]! *= scale;
    }
  }
  return out;
}

export function applyColumnScalesToStep(
  scaledStep: readonly number[],
  columnScales: readonly number[],
): number[] {
  return scaledStep.map((delta, index) => delta * (columnScales[index] ?? 1));
}
