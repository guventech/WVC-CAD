/**
 * Millimetre grid spacing chosen from camera scale (pixels per mm).
 * Spacing is always a 1 / 2 / 5 × 10^n millimetre step, never an arbitrary pixel pitch.
 */

export interface GridSpacing {
  /** Minor grid step in millimetres. */
  readonly minorMm: number;
  /** Major grid step in millimetres. Major lines fall on multiples of this. */
  readonly majorMm: number;
}

/** Preferred on-screen distance between minor grid lines. */
const TARGET_MINOR_PIXELS = 28;

const DECADE_STEPS = [1, 2, 5] as const;

export function chooseGridSpacing(pixelsPerMm: number): GridSpacing {
  if (!(pixelsPerMm > 0) || !Number.isFinite(pixelsPerMm)) {
    return { minorMm: 10, majorMm: 50 };
  }

  const rawMm = TARGET_MINOR_PIXELS / pixelsPerMm;
  const minorMm = snapToEngineeringStep(rawMm);
  const majorMm = minorMm * 5;

  return { minorMm, majorMm };
}

function snapToEngineeringStep(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) {
    return 10;
  }

  const exponent = Math.floor(Math.log10(value));
  const power = 10 ** exponent;
  const mantissa = value / power;

  for (const step of DECADE_STEPS) {
    if (mantissa <= step) {
      return step * power;
    }
  }

  return 10 * power;
}
