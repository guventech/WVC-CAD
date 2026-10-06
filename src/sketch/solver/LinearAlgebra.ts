/**
 * Dense linear-algebra helpers for the Levenberg–Marquardt solver.
 * Systems stay small (hundreds of variables), so O(n³) dense solves are fine.
 */

/** Multiply A (rows×cols) by x (cols) → rows. */
export function matVec(
  rows: number,
  cols: number,
  a: readonly number[],
  x: readonly number[],
): number[] {
  const y = new Array<number>(rows).fill(0);
  for (let i = 0; i < rows; i += 1) {
    let sum = 0;
    const row = i * cols;
    for (let j = 0; j < cols; j += 1) {
      sum += a[row + j]! * x[j]!;
    }
    y[i] = sum;
  }
  return y;
}

/** y = Aᵀ x for A (rows×cols). */
export function matTransposeVec(
  rows: number,
  cols: number,
  a: readonly number[],
  x: readonly number[],
): number[] {
  const y = new Array<number>(cols).fill(0);
  for (let i = 0; i < rows; i += 1) {
    const xi = x[i]!;
    const row = i * cols;
    for (let j = 0; j < cols; j += 1) {
      y[j]! += a[row + j]! * xi;
    }
  }
  return y;
}

/** C = Aᵀ A for A (rows×cols) → cols×cols, column-major-free row-major. */
export function matTransposeMat(
  rows: number,
  cols: number,
  a: readonly number[],
): number[] {
  const c = new Array<number>(cols * cols).fill(0);
  for (let i = 0; i < rows; i += 1) {
    const row = i * cols;
    for (let j = 0; j < cols; j += 1) {
      const aij = a[row + j]!;
      for (let k = 0; k < cols; k += 1) {
        c[j * cols + k]! += aij * a[row + k]!;
      }
    }
  }
  return c;
}

export function vecNormInf(v: readonly number[]): number {
  let max = 0;
  for (const value of v) {
    const abs = Math.abs(value);
    if (abs > max) {
      max = abs;
    }
  }
  return max;
}

export function vecNorm2(v: readonly number[]): number {
  let sum = 0;
  for (const value of v) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

export function vecAdd(
  a: readonly number[],
  b: readonly number[],
  scaleB = 1,
): number[] {
  return a.map((value, index) => value + scaleB * b[index]!);
}

/**
 * Solve A x = b for symmetric positive-definite A (n×n) via Cholesky.
 * Returns null when A is not SPD (numerically).
 */
export function solveCholesky(
  n: number,
  a: readonly number[],
  b: readonly number[],
): number[] | null {
  const l = new Array<number>(n * n).fill(0);

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = a[i * n + j]!;
      for (let k = 0; k < j; k += 1) {
        sum -= l[i * n + k]! * l[j * n + k]!;
      }
      if (i === j) {
        if (!(sum > 1e-18)) {
          return null;
        }
        l[i * n + j] = Math.sqrt(sum);
      } else {
        l[i * n + j] = sum / l[j * n + j]!;
      }
    }
  }

  // L y = b
  const y = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    let sum = b[i]!;
    for (let k = 0; k < i; k += 1) {
      sum -= l[i * n + k]! * y[k]!;
    }
    y[i] = sum / l[i * n + i]!;
  }

  // Lᵀ x = y
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = y[i]!;
    for (let k = i + 1; k < n; k += 1) {
      sum -= l[k * n + i]! * x[k]!;
    }
    x[i] = sum / l[i * n + i]!;
  }

  return x;
}

/**
 * Numerical rank of a dense matrix (rows × cols, row-major) via Gaussian
 * elimination with partial pivoting. Entries below `tolerance` are treated as zero.
 */
export function matrixRank(
  rows: number,
  cols: number,
  matrix: readonly number[],
  tolerance: number,
): number {
  return matrixPivotColumns(rows, cols, matrix, tolerance).rank;
}

export interface MatrixPivotResult {
  readonly rank: number;
  /** Column indices selected as pivots (dependent / constrained directions). */
  readonly pivotColumns: readonly number[];
}

/**
 * Gaussian elimination with partial pivoting; returns rank and which columns
 * were chosen as pivots. Non-pivot columns are free directions (nullspace).
 */
export function matrixPivotColumns(
  rows: number,
  cols: number,
  matrix: readonly number[],
  tolerance: number,
): MatrixPivotResult {
  if (rows === 0 || cols === 0) {
    return { rank: 0, pivotColumns: [] };
  }

  const a = matrix.slice();
  const rowCount = rows;
  const colCount = cols;
  const pivotColumns: number[] = [];
  let row = 0;

  for (let col = 0; col < colCount && row < rowCount; col += 1) {
    let pivotRow = row;
    let pivotAbs = Math.abs(a[row * colCount + col]!);
    for (let r = row + 1; r < rowCount; r += 1) {
      const candidate = Math.abs(a[r * colCount + col]!);
      if (candidate > pivotAbs) {
        pivotAbs = candidate;
        pivotRow = r;
      }
    }

    if (pivotAbs <= tolerance) {
      continue;
    }

    if (pivotRow !== row) {
      for (let c = col; c < colCount; c += 1) {
        const i = row * colCount + c;
        const j = pivotRow * colCount + c;
        const tmp = a[i]!;
        a[i] = a[j]!;
        a[j] = tmp;
      }
    }

    const pivot = a[row * colCount + col]!;
    for (let r = row + 1; r < rowCount; r += 1) {
      const factor = a[r * colCount + col]! / pivot;
      if (Math.abs(factor) <= tolerance) {
        a[r * colCount + col] = 0;
        continue;
      }
      a[r * colCount + col] = 0;
      for (let c = col + 1; c < colCount; c += 1) {
        a[r * colCount + c]! -= factor * a[row * colCount + c]!;
      }
    }

    pivotColumns.push(col);
    row += 1;
  }

  return { rank: pivotColumns.length, pivotColumns };
}

/**
 * Solve the damped normal equations (Jᵀ J + λ I) δ = −Jᵀ F.
 * Falls back to increasing λ when Cholesky fails.
 */
export function solveNormalEquations(
  residualCount: number,
  variableCount: number,
  jacobian: readonly number[],
  residual: readonly number[],
  lambda: number,
): number[] | null {
  if (variableCount === 0) {
    return [];
  }

  const jtJ = matTransposeMat(residualCount, variableCount, jacobian);
  for (let i = 0; i < variableCount; i += 1) {
    jtJ[i * variableCount + i]! += lambda;
  }
  const jtF = matTransposeVec(residualCount, variableCount, jacobian, residual);
  const rhs = jtF.map((value) => -value);
  return solveCholesky(variableCount, jtJ, rhs);
}
