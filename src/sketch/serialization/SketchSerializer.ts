import { getConstraintTypeInfo } from "../constraints/ConstraintTypes.ts";
import { validateAllConstraints } from "../constraints/ConstraintValidator.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type {
  Constraint,
  ConstraintReference,
  ConstraintRole,
  ConstraintType,
} from "../model/Constraint.ts";
import type {
  ArcGeometry,
  CircleGeometry,
  Geometry,
  LineGeometry,
  PointGeometry,
} from "../model/Geometry.ts";
import {
  createDefaultSketchFrame,
  DATUM_AXIS_X_ID,
  DATUM_AXIS_Y_ID,
  DATUM_ORIGIN_ID,
  DEFAULT_FRAME_ID,
  type SketchFrame,
} from "../model/SketchFrame.ts";
import {
  createDefaultSketchSettings,
  type SketchSettings,
} from "../model/SketchSettings.ts";
import type { Sketch } from "../model/Sketch.ts";
import { syncEntityIdCounterFromSketch } from "./EntityIdSync.ts";
import {
  SKETCH_APP_NAME,
  SKETCH_SCHEMA_VERSION,
  SKETCH_UNITS,
  type SketchDocument,
} from "./SketchSchema.ts";

export type SketchParseOutcome =
  | { readonly ok: true; readonly sketch: Sketch; readonly document: SketchDocument }
  | { readonly ok: false; readonly reason: string };

/** Reject crafted / absurd inputs before they reach the solver or UI thread. */
export const SKETCH_LOAD_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxGeometry: 5_000,
  maxConstraints: 10_000,
  /** Absolute coordinate / dimension magnitude (mm or radians as stored). */
  maxAbsValue: 1e9,
} as const;

const CONSTRAINT_ROLES = new Set<ConstraintRole>([
  "start",
  "end",
  "center",
  "position",
  "entity",
  "point",
  "object",
  "first",
  "second",
  "axis",
  "corner-bl",
  "corner-br",
  "corner-tr",
  "corner-tl",
  "edge-bottom",
  "edge-right",
  "edge-top",
  "edge-left",
]);

/** Build a versioned document from the live sketch model. */
export function sketchToDocument(
  sketch: Sketch,
  options?: { readonly savedAt?: string },
): SketchDocument {
  if (sketch.units !== SKETCH_UNITS) {
    throw new Error(
      `Cannot serialize sketch with units "${sketch.units}"; only "${SKETCH_UNITS}" is supported.`,
    );
  }

  return {
    schemaVersion: SKETCH_SCHEMA_VERSION,
    units: SKETCH_UNITS,
    id: sketch.id,
    name: sketch.name,
    geometry: sketch.geometry.map(cloneGeometry),
    constraints: sketch.constraints.map(cloneConstraint),
    settings: { ...sketch.settings },
    frame: cloneFrame(sketch.frame),
    metadata: {
      savedAt: options?.savedAt ?? new Date().toISOString(),
      app: SKETCH_APP_NAME,
    },
  };
}

export function serializeSketchToJson(
  sketch: Sketch,
  options?: { readonly savedAt?: string; readonly pretty?: boolean },
): string {
  const document = sketchToDocument(sketch, { savedAt: options?.savedAt });
  return JSON.stringify(document, null, options?.pretty === false ? undefined : 2);
}

/**
 * Parse JSON text into a Sketch. Rejects unknown schema versions and non-mm units.
 * On success, syncs the entity-id counter for subsequent creates.
 */
export function parseSketchJson(text: string): SketchParseOutcome {
  if (text.length > SKETCH_LOAD_LIMITS.maxFileBytes) {
    return {
      ok: false,
      reason: `File is too large (${text.length} bytes; max ${SKETCH_LOAD_LIMITS.maxFileBytes}).`,
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, reason: "File is not valid JSON." };
  }

  return parseSketchDocument(raw);
}

export function parseSketchDocument(raw: unknown): SketchParseOutcome {
  if (!isRecord(raw)) {
    return { ok: false, reason: "Sketch document must be a JSON object." };
  }

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== SKETCH_SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        typeof schemaVersion === "number"
          ? `Unsupported schema version ${schemaVersion} (expected ${SKETCH_SCHEMA_VERSION}).`
          : `Missing or invalid schemaVersion (expected ${SKETCH_SCHEMA_VERSION}).`,
    };
  }

  if (raw.units !== SKETCH_UNITS) {
    return {
      ok: false,
      reason:
        raw.units === undefined
          ? `Missing units (expected "${SKETCH_UNITS}").`
          : `Unsupported units "${String(raw.units)}" (expected "${SKETCH_UNITS}"). Model units are never converted on load.`,
    };
  }

  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return { ok: false, reason: "Sketch id must be a non-empty string." };
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    return { ok: false, reason: "Sketch name must be a non-empty string." };
  }

  if (!Array.isArray(raw.geometry)) {
    return { ok: false, reason: "geometry must be an array." };
  }
  if (!Array.isArray(raw.constraints)) {
    return { ok: false, reason: "constraints must be an array." };
  }
  if (raw.geometry.length > SKETCH_LOAD_LIMITS.maxGeometry) {
    return {
      ok: false,
      reason: `Too many geometry entities (${raw.geometry.length}; max ${SKETCH_LOAD_LIMITS.maxGeometry}).`,
    };
  }
  if (raw.constraints.length > SKETCH_LOAD_LIMITS.maxConstraints) {
    return {
      ok: false,
      reason: `Too many constraints (${raw.constraints.length}; max ${SKETCH_LOAD_LIMITS.maxConstraints}).`,
    };
  }

  const geometry: Geometry[] = [];
  const seenGeometryIds = new Set<string>();
  for (let i = 0; i < raw.geometry.length; i += 1) {
    const parsed = parseGeometry(raw.geometry[i], i);
    if (!parsed.ok) {
      return parsed;
    }
    if (seenGeometryIds.has(parsed.geometry.id)) {
      return {
        ok: false,
        reason: `Duplicate geometry id "${parsed.geometry.id}".`,
      };
    }
    seenGeometryIds.add(parsed.geometry.id);
    geometry.push(parsed.geometry);
  }

  const constraints: Constraint[] = [];
  const seenConstraintIds = new Set<string>();
  for (let i = 0; i < raw.constraints.length; i += 1) {
    const parsed = parseConstraint(raw.constraints[i], i);
    if (!parsed.ok) {
      return parsed;
    }
    if (seenConstraintIds.has(parsed.constraint.id)) {
      return {
        ok: false,
        reason: `Duplicate constraint id "${parsed.constraint.id}".`,
      };
    }
    seenConstraintIds.add(parsed.constraint.id);
    constraints.push(parsed.constraint);
  }

  const settingsResult = parseSettings(raw.settings);
  if (!settingsResult.ok) {
    return settingsResult;
  }

  const frameResult = parseFrame(raw.frame);
  if (!frameResult.ok) {
    return frameResult;
  }

  const document: SketchDocument = {
    schemaVersion: SKETCH_SCHEMA_VERSION,
    units: SKETCH_UNITS,
    id: raw.id,
    name: raw.name,
    geometry,
    constraints,
    settings: settingsResult.settings,
    frame: frameResult.frame,
    metadata: parseMetadata(raw.metadata),
  };

  const sketch: Sketch = {
    id: document.id,
    name: document.name,
    units: document.units,
    geometry: document.geometry,
    constraints: document.constraints,
    settings: document.settings,
    frame: document.frame ?? createDefaultSketchFrame(),
    version: SKETCH_SCHEMA_VERSION,
  };

  const validation = validateAllConstraints(sketch);
  if (!validation.ok) {
    const first = validation.issues[0];
    return {
      ok: false,
      reason:
        first === undefined
          ? "Constraint validation failed."
          : `Constraint "${first.constraintId}": ${first.message}`,
    };
  }

  syncEntityIdCounterFromSketch(sketch);
  return { ok: true, sketch, document };
}

function cloneGeometry(entity: Geometry): Geometry {
  switch (entity.type) {
    case "point":
      return {
        id: entity.id,
        type: "point",
        position: { ...entity.position },
        construction: entity.construction,
      };
    case "line":
      return {
        id: entity.id,
        type: "line",
        start: { ...entity.start },
        end: { ...entity.end },
        construction: entity.construction,
      };
    case "circle":
      return {
        id: entity.id,
        type: "circle",
        center: { ...entity.center },
        radius: entity.radius,
        construction: entity.construction,
      };
    case "arc":
      return {
        id: entity.id,
        type: "arc",
        center: { ...entity.center },
        radius: entity.radius,
        startAngle: entity.startAngle,
        endAngle: entity.endAngle,
        construction: entity.construction,
      };
  }
}

function cloneConstraint(constraint: Constraint): Constraint {
  return {
    id: constraint.id,
    type: constraint.type,
    references: constraint.references.map((reference) => ({ ...reference })),
    ...(constraint.value !== undefined ? { value: constraint.value } : {}),
    ...(constraint.driving !== undefined ? { driving: constraint.driving } : {}),
    ...(constraint.locked !== undefined
      ? {
          locked: {
            x: constraint.locked.x,
            y: constraint.locked.y,
            ...(constraint.locked.endX !== undefined
              ? { endX: constraint.locked.endX, endY: constraint.locked.endY }
              : {}),
            ...(constraint.locked.radius !== undefined
              ? { radius: constraint.locked.radius }
              : {}),
          },
        }
      : {}),
  };
}

function cloneFrame(frame: SketchFrame): SketchFrame {
  return {
    id: frame.id,
    originId: frame.originId,
    axes: frame.axes.map((axis) => ({
      id: axis.id,
      tag: axis.tag,
      direction: { ...axis.direction },
    })),
  };
}

function parseGeometry(
  raw: unknown,
  index: number,
): { ok: true; geometry: Geometry } | { ok: false; reason: string } {
  if (!isRecord(raw)) {
    return { ok: false, reason: `geometry[${index}] must be an object.` };
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return { ok: false, reason: `geometry[${index}] needs a non-empty id.` };
  }
  if (typeof raw.construction !== "boolean") {
    return {
      ok: false,
      reason: `geometry[${index}] needs a boolean construction flag.`,
    };
  }

  switch (raw.type) {
    case "point": {
      const position = parsePoint2D(raw.position, `geometry[${index}].position`);
      if (!position.ok) {
        return position;
      }
      const geometry: PointGeometry = {
        id: raw.id,
        type: "point",
        position: position.point,
        construction: raw.construction,
      };
      return { ok: true, geometry };
    }
    case "line": {
      const start = parsePoint2D(raw.start, `geometry[${index}].start`);
      if (!start.ok) {
        return start;
      }
      const end = parsePoint2D(raw.end, `geometry[${index}].end`);
      if (!end.ok) {
        return end;
      }
      const dx = end.point.x - start.point.x;
      const dy = end.point.y - start.point.y;
      if (dx * dx + dy * dy <= TOLERANCE.coincidence * TOLERANCE.coincidence) {
        return {
          ok: false,
          reason: `geometry[${index}] line must have non-zero length.`,
        };
      }
      const geometry: LineGeometry = {
        id: raw.id,
        type: "line",
        start: start.point,
        end: end.point,
        construction: raw.construction,
      };
      return { ok: true, geometry };
    }
    case "circle": {
      const center = parsePoint2D(raw.center, `geometry[${index}].center`);
      if (!center.ok) {
        return center;
      }
      const radius = parseFiniteNumber(raw.radius, `geometry[${index}].radius`);
      if (!radius.ok) {
        return radius;
      }
      if (radius.value <= TOLERANCE.coincidence) {
        return {
          ok: false,
          reason: `geometry[${index}].radius must be positive.`,
        };
      }
      const geometry: CircleGeometry = {
        id: raw.id,
        type: "circle",
        center: center.point,
        radius: radius.value,
        construction: raw.construction,
      };
      return { ok: true, geometry };
    }
    case "arc": {
      const center = parsePoint2D(raw.center, `geometry[${index}].center`);
      if (!center.ok) {
        return center;
      }
      const radius = parseFiniteNumber(raw.radius, `geometry[${index}].radius`);
      if (!radius.ok) {
        return radius;
      }
      if (radius.value <= TOLERANCE.coincidence) {
        return {
          ok: false,
          reason: `geometry[${index}].radius must be positive.`,
        };
      }
      const startAngle = parseFiniteNumber(
        raw.startAngle,
        `geometry[${index}].startAngle`,
      );
      if (!startAngle.ok) {
        return startAngle;
      }
      const endAngle = parseFiniteNumber(
        raw.endAngle,
        `geometry[${index}].endAngle`,
      );
      if (!endAngle.ok) {
        return endAngle;
      }
      const geometry: ArcGeometry = {
        id: raw.id,
        type: "arc",
        center: center.point,
        radius: radius.value,
        startAngle: startAngle.value,
        endAngle: endAngle.value,
        construction: raw.construction,
      };
      return { ok: true, geometry };
    }
    default:
      return {
        ok: false,
        reason: `geometry[${index}] has unknown type "${String(raw.type)}".`,
      };
  }
}

function parseConstraint(
  raw: unknown,
  index: number,
): { ok: true; constraint: Constraint } | { ok: false; reason: string } {
  if (!isRecord(raw)) {
    return { ok: false, reason: `constraints[${index}] must be an object.` };
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return { ok: false, reason: `constraints[${index}] needs a non-empty id.` };
  }
  if (typeof raw.type !== "string") {
    return { ok: false, reason: `constraints[${index}] needs a type string.` };
  }
  const info = getConstraintTypeInfo(raw.type as ConstraintType);
  if (info === undefined) {
    return {
      ok: false,
      reason: `constraints[${index}] has unknown type "${raw.type}".`,
    };
  }
  if (!Array.isArray(raw.references)) {
    return {
      ok: false,
      reason: `constraints[${index}].references must be an array.`,
    };
  }

  const references: ConstraintReference[] = [];
  for (let i = 0; i < raw.references.length; i += 1) {
    const refRaw = raw.references[i];
    if (!isRecord(refRaw)) {
      return {
        ok: false,
        reason: `constraints[${index}].references[${i}] must be an object.`,
      };
    }
    if (typeof refRaw.entityId !== "string" || refRaw.entityId.length === 0) {
      return {
        ok: false,
        reason: `constraints[${index}].references[${i}].entityId is invalid.`,
      };
    }
    if (typeof refRaw.role !== "string" || !CONSTRAINT_ROLES.has(refRaw.role as ConstraintRole)) {
      return {
        ok: false,
        reason: `constraints[${index}].references[${i}].role is invalid.`,
      };
    }
    references.push({
      entityId: refRaw.entityId,
      role: refRaw.role as ConstraintRole,
    });
  }

  let value: number | undefined;
  if (raw.value !== undefined) {
    const parsedValue = parseFiniteNumber(
      raw.value,
      `constraints[${index}].value`,
    );
    if (!parsedValue.ok) {
      return parsedValue;
    }
    value = parsedValue.value;
  }

  let driving: boolean | undefined;
  if (raw.driving !== undefined) {
    if (typeof raw.driving !== "boolean") {
      return {
        ok: false,
        reason: `constraints[${index}].driving must be a boolean when present.`,
      };
    }
    driving = raw.driving;
  }

  let locked: Constraint["locked"] | undefined;
  if (raw.locked !== undefined) {
    if (!isRecord(raw.locked)) {
      return {
        ok: false,
        reason: `constraints[${index}].locked must be an object when present.`,
      };
    }
    const lockedX = parseFiniteNumber(
      raw.locked.x,
      `constraints[${index}].locked.x`,
    );
    if (!lockedX.ok) {
      return lockedX;
    }
    const lockedY = parseFiniteNumber(
      raw.locked.y,
      `constraints[${index}].locked.y`,
    );
    if (!lockedY.ok) {
      return lockedY;
    }
    const next: {
      x: number;
      y: number;
      endX?: number;
      endY?: number;
      radius?: number;
    } = { x: lockedX.value, y: lockedY.value };
    if (raw.locked.endX !== undefined || raw.locked.endY !== undefined) {
      const endX = parseFiniteNumber(
        raw.locked.endX,
        `constraints[${index}].locked.endX`,
      );
      if (!endX.ok) {
        return endX;
      }
      const endY = parseFiniteNumber(
        raw.locked.endY,
        `constraints[${index}].locked.endY`,
      );
      if (!endY.ok) {
        return endY;
      }
      next.endX = endX.value;
      next.endY = endY.value;
    }
    if (raw.locked.radius !== undefined) {
      const lockedRadius = parseFiniteNumber(
        raw.locked.radius,
        `constraints[${index}].locked.radius`,
      );
      if (!lockedRadius.ok) {
        return lockedRadius;
      }
      next.radius = lockedRadius.value;
    }
    locked = next;
  }

  if (raw.type === "fix" && locked === undefined) {
    return {
      ok: false,
      reason: `constraints[${index}] (fix) requires locked { x, y }.`,
    };
  }

  const constraint: Constraint = {
    id: raw.id,
    type: raw.type as ConstraintType,
    references,
    ...(value !== undefined ? { value } : {}),
    ...(driving !== undefined ? { driving } : {}),
    ...(locked !== undefined ? { locked } : {}),
  };

  return { ok: true, constraint };
}

function parseSettings(
  raw: unknown,
): { ok: true; settings: SketchSettings } | { ok: false; reason: string } {
  if (raw === undefined) {
    return { ok: true, settings: createDefaultSketchSettings() };
  }
  if (!isRecord(raw)) {
    return { ok: false, reason: "settings must be an object when present." };
  }
  if (typeof raw.gridVisible !== "boolean") {
    return { ok: false, reason: "settings.gridVisible must be a boolean." };
  }
  return { ok: true, settings: { gridVisible: raw.gridVisible } };
}

function parseFrame(
  raw: unknown,
): { ok: true; frame: SketchFrame } | { ok: false; reason: string } {
  if (raw === undefined) {
    return { ok: true, frame: createDefaultSketchFrame() };
  }
  if (!isRecord(raw)) {
    return { ok: false, reason: "frame must be an object when present." };
  }

  const expected = createDefaultSketchFrame();
  if (raw.id !== DEFAULT_FRAME_ID) {
    return {
      ok: false,
      reason: `Unsupported frame id "${String(raw.id)}" (expected "${DEFAULT_FRAME_ID}").`,
    };
  }
  if (raw.originId !== DATUM_ORIGIN_ID) {
    return {
      ok: false,
      reason: `Unsupported frame origin "${String(raw.originId)}".`,
    };
  }
  if (!Array.isArray(raw.axes) || raw.axes.length !== 2) {
    return { ok: false, reason: "frame.axes must contain X and Y axes." };
  }

  const x = raw.axes.find(
    (axis) => isRecord(axis) && axis.id === DATUM_AXIS_X_ID && axis.tag === "x",
  );
  const y = raw.axes.find(
    (axis) => isRecord(axis) && axis.id === DATUM_AXIS_Y_ID && axis.tag === "y",
  );
  if (!isRecord(x) || !isRecord(y)) {
    return { ok: false, reason: "frame must include datum:axis:x and datum:axis:y." };
  }

  const xDir = parsePoint2D(x.direction, "frame.axes[x].direction");
  if (!xDir.ok) {
    return xDir;
  }
  const yDir = parsePoint2D(y.direction, "frame.axes[y].direction");
  if (!yDir.ok) {
    return yDir;
  }
  if (xDir.point.x !== 1 || xDir.point.y !== 0 || yDir.point.x !== 0 || yDir.point.y !== 1) {
    return {
      ok: false,
      reason: "Only the default world frame (+X right, +Y up) is supported.",
    };
  }

  return { ok: true, frame: expected };
}

function parseMetadata(
  raw: unknown,
): SketchDocument["metadata"] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    return undefined;
  }
  return {
    ...(typeof raw.savedAt === "string" ? { savedAt: raw.savedAt } : {}),
    ...(typeof raw.app === "string" ? { app: raw.app } : {}),
  };
}

function parseFiniteNumber(
  value: unknown,
  path: string,
): { ok: true; value: number } | { ok: false; reason: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, reason: `${path} must be a finite number.` };
  }
  if (Math.abs(value) > SKETCH_LOAD_LIMITS.maxAbsValue) {
    return {
      ok: false,
      reason: `${path} magnitude ${value} exceeds ±${SKETCH_LOAD_LIMITS.maxAbsValue}.`,
    };
  }
  return { ok: true, value };
}

function parsePoint2D(
  raw: unknown,
  path: string,
): { ok: true; point: { x: number; y: number } } | { ok: false; reason: string } {
  if (!isRecord(raw)) {
    return { ok: false, reason: `${path} must be an object.` };
  }
  const x = parseFiniteNumber(raw.x, `${path}.x`);
  if (!x.ok) {
    return x;
  }
  const y = parseFiniteNumber(raw.y, `${path}.y`);
  if (!y.ok) {
    return y;
  }
  return { ok: true, point: { x: x.value, y: y.value } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
