/**
 * Isolated unit parsing for dimension edit fields (Chunk 18).
 * Model units remain mm (length) or radians (angle); UI may accept ° / deg / mm.
 */

export type DimensionInputKind = "length" | "angle";

export type ParseDimensionInputResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: string };

/**
 * Parse user text into model units.
 * Length → millimetres. Angle → radians.
 */
export function parseDimensionInput(
  text: string,
  kind: DimensionInputKind,
): ParseDimensionInputResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Enter a numeric value." };
  }

  if (kind === "angle") {
    return parseAngle(trimmed);
  }
  return parseLength(trimmed);
}

function parseLength(text: string): ParseDimensionInputResult {
  const match = text.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(mm)?$/i);
  if (match === null) {
    return { ok: false, reason: "Invalid length. Use a number in mm (e.g. 75 or 75 mm)." };
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return { ok: false, reason: "Invalid length value." };
  }
  return { ok: true, value };
}

function parseAngle(text: string): ParseDimensionInputResult {
  const match = text.match(
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(°|deg|degree|degrees|rad|radians?)?$/i,
  );
  if (match === null) {
    return {
      ok: false,
      reason: "Invalid angle. Use degrees (e.g. 90 or 90°) or radians (e.g. 1.57 rad).",
    };
  }
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) {
    return { ok: false, reason: "Invalid angle value." };
  }
  const unit = (match[2] ?? "deg").toLowerCase();
  if (unit.startsWith("rad")) {
    return { ok: true, value: raw };
  }
  return { ok: true, value: (raw * Math.PI) / 180 };
}

/** Format a model value for an edit field (degrees for angle, plain mm otherwise). */
export function formatDimensionInputValue(
  value: number,
  kind: DimensionInputKind,
): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  if (kind === "angle") {
    return ((value * 180) / Math.PI).toFixed(1);
  }
  return value.toFixed(2);
}
