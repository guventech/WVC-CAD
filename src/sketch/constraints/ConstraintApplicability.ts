import type { ConstraintCreateRequest } from "../commands/AddMaintainedConstraintCommand.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  isDatumOriginId,
  resolveFrameAxisLine,
} from "../model/SketchFrame.ts";
import type { ActiveTool } from "../tools/ActiveTool.ts";
import { isConstraintPickTool } from "../tools/ActiveTool.ts";
import { classifyDistancePicks } from "./SmartDistance.ts";
import { classifyRadialPick } from "./SmartRadial.ts";

export type ApplicabilityState = "enabled" | "disabled";

export type ConstraintApplicability = {
  readonly toolId: ActiveTool;
  readonly state: ApplicabilityState;
  /** Hover / tooltip reason when disabled, or short guidance when enabled. */
  readonly reason: string;
  /** True when current selection alone can create the constraint. */
  readonly canApply: boolean;
};

export type SelectionKinds = {
  readonly lineIds: readonly EntityId[];
  readonly pointIds: readonly EntityId[];
  readonly curveIds: readonly EntityId[];
  readonly axisIds: readonly EntityId[];
  /** Standalone points + treated as point-like targets for offsets. */
  readonly pointLikeCount: number;
  readonly lineCount: number;
  readonly curveCount: number;
  readonly axisCount: number;
};

const CONTEXT_TOOLS: readonly ActiveTool[] = [
  "coincident",
  "horizontal",
  "vertical",
  "parallel",
  "perpendicular",
  "tangent",
  "concentric",
  "midpoint",
  "equal",
  "symmetric",
  "point-on-object",
  "fix",
  "dim-distance",
  "dim-radial",
  "dim-angle",
];

export function contextConstraintToolIds(): readonly ActiveTool[] {
  return CONTEXT_TOOLS;
}

/**
 * Classify selected entity ids into constraint pick kinds (domain-only).
 * Rectangle multi-select contributes each distinct line/point once.
 */
export function classifySelection(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
): SelectionKinds {
  const lineIds: EntityId[] = [];
  const pointIds: EntityId[] = [];
  const curveIds: EntityId[] = [];
  const axisIds: EntityId[] = [];
  const seen = new Set<EntityId>();

  for (const id of selectedIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    if (isDatumOriginId(sketch.frame, id)) {
      pointIds.push(id);
      continue;
    }
    if (resolveFrameAxisLine(sketch.frame, id) !== null) {
      axisIds.push(id);
      continue;
    }
    const entity = sketch.geometry.find((item) => item.id === id);
    if (entity === undefined) {
      continue;
    }
    if (entity.type === "line") {
      lineIds.push(id);
    } else if (entity.type === "point") {
      pointIds.push(id);
    } else if (entity.type === "circle" || entity.type === "arc") {
      curveIds.push(id);
    }
  }

  return {
    lineIds,
    pointIds,
    curveIds,
    axisIds,
    pointLikeCount: pointIds.length,
    lineCount: lineIds.length,
    curveCount: curveIds.length,
    axisCount: axisIds.length,
  };
}

function lineRef(id: EntityId): ConstraintReference {
  return { entityId: id, role: "entity" };
}

function pointRef(id: EntityId): ConstraintReference {
  return { entityId: id, role: "position" };
}

function curveRef(id: EntityId): ConstraintReference {
  return { entityId: id, role: "entity" };
}

function enabled(
  toolId: ActiveTool,
  reason: string,
  canApply: boolean,
): ConstraintApplicability {
  return { toolId, state: "enabled", reason, canApply };
}

function disabled(toolId: ActiveTool, reason: string): ConstraintApplicability {
  return { toolId, state: "disabled", reason, canApply: false };
}

function evaluateOne(
  toolId: ActiveTool,
  kinds: SelectionKinds,
): ConstraintApplicability {
  const { lineCount, curveCount, pointLikeCount, axisCount } = kinds;
  const totalLines = lineCount + axisCount;

  switch (toolId) {
    case "coincident": {
      if (pointLikeCount >= 2) {
        return enabled(toolId, "Coincident: apply to two selected points", true);
      }
      if (pointLikeCount === 1 && lineCount >= 1) {
        return enabled(toolId, "Coincident: point on selected line", true);
      }
      if (pointLikeCount === 1) {
        return enabled(toolId, "Coincident: pick a second point or line", false);
      }
      return disabled(toolId, "Needs a point (and another point or a line)");
    }
    case "horizontal":
    case "vertical": {
      const label = toolId === "horizontal" ? "Horizontal" : "Vertical";
      if (lineCount === 1 && pointLikeCount === 0) {
        return enabled(toolId, `${label}: apply to selected line`, true);
      }
      if (pointLikeCount === 2) {
        return enabled(toolId, `${label}: apply to two selected points`, true);
      }
      if (pointLikeCount === 1) {
        return enabled(toolId, `${label}: pick a second point`, false);
      }
      if (lineCount > 1) {
        return disabled(toolId, `Select a single line for ${label}`);
      }
      return disabled(toolId, `Needs a line, or two points`);
    }
    case "parallel":
    case "perpendicular": {
      const label = toolId === "parallel" ? "Parallel" : "Perpendicular";
      if (totalLines >= 2) {
        return enabled(toolId, `${label}: apply to two selected lines`, true);
      }
      if (totalLines === 1) {
        return enabled(toolId, `${label}: pick a second line`, false);
      }
      return disabled(toolId, `Needs two lines`);
    }
    case "tangent": {
      if (
        (lineCount >= 1 && curveCount >= 1) ||
        curveCount >= 2
      ) {
        return enabled(toolId, "Tangent: apply to selected entities", true);
      }
      if (lineCount >= 1 || curveCount >= 1) {
        return enabled(toolId, "Tangent: pick a curve (or line + curve)", false);
      }
      return disabled(toolId, "Needs a line and a curve, or two curves");
    }
    case "concentric": {
      if (curveCount >= 2) {
        return enabled(toolId, "Concentric: apply to two curves", true);
      }
      if (curveCount === 1) {
        return enabled(toolId, "Concentric: pick a second circle or arc", false);
      }
      return disabled(toolId, "Needs two circles or arcs");
    }
    case "midpoint": {
      if (pointLikeCount >= 1 && lineCount >= 1) {
        return enabled(toolId, "Midpoint: apply to point and line", true);
      }
      if (pointLikeCount >= 1 || lineCount >= 1) {
        return enabled(toolId, "Midpoint: pick the other (point or line)", false);
      }
      return disabled(toolId, "Needs a point and a line");
    }
    case "equal": {
      if (lineCount >= 2) {
        return enabled(toolId, "Equal: apply equal lengths", true);
      }
      if (curveCount >= 2) {
        return enabled(toolId, "Equal: apply equal radii", true);
      }
      if (lineCount === 1 || curveCount === 1) {
        return enabled(toolId, "Equal: pick a second entity of the same kind", false);
      }
      return disabled(toolId, "Needs two lines or two curves");
    }
    case "symmetric": {
      if (pointLikeCount >= 2 && totalLines >= 1) {
        return enabled(toolId, "Symmetric: apply about selected mirror", true);
      }
      if (pointLikeCount + totalLines >= 1) {
        return enabled(
          toolId,
          "Symmetric: need two points and one mirror line",
          false,
        );
      }
      return disabled(toolId, "Needs two points and a mirror line");
    }
    case "point-on-object": {
      if (
        pointLikeCount >= 1 &&
        (lineCount >= 1 || curveCount >= 1)
      ) {
        return enabled(toolId, "On object: apply to point and entity", true);
      }
      if (pointLikeCount >= 1 || lineCount >= 1 || curveCount >= 1) {
        return enabled(toolId, "On object: pick the other entity", false);
      }
      return disabled(toolId, "Needs a point and a line/circle/arc");
    }
    case "fix": {
      if (pointLikeCount === 1 && lineCount === 0 && curveCount === 0) {
        return enabled(toolId, "Fix: apply to selected point", true);
      }
      if (lineCount === 1 && pointLikeCount === 0 && curveCount === 0) {
        return enabled(toolId, "Fix: apply to selected line", true);
      }
      if (curveCount === 1 && pointLikeCount === 0 && lineCount === 0) {
        return enabled(toolId, "Fix: apply to selected curve", true);
      }
      if (pointLikeCount + lineCount + curveCount > 1) {
        return disabled(toolId, "Select a single point, line, or curve");
      }
      return disabled(toolId, "Needs a point, line, or circle/arc");
    }
    case "dim-distance": {
      if (lineCount === 1 && pointLikeCount === 0 && axisCount === 0) {
        return enabled(toolId, "Distance: apply length to selected line", true);
      }
      if (pointLikeCount === 2) {
        return enabled(toolId, "Distance: apply between two points", true);
      }
      if (pointLikeCount === 1 && totalLines >= 1) {
        return enabled(toolId, "Distance: locate vs selected line/axis", true);
      }
      if (totalLines >= 2) {
        return enabled(toolId, "Distance: apply between two lines/axes", true);
      }
      if (pointLikeCount === 1) {
        return enabled(toolId, "Distance: pick a second point, line, or axis", false);
      }
      if (totalLines === 1) {
        return enabled(toolId, "Distance: pick another line/axis (or same line for length)", false);
      }
      return disabled(toolId, "Needs a line, two points, or a point/line + axis");
    }
    case "dim-radial": {
      if (curveCount === 1) {
        return enabled(
          toolId,
          "Size: circle → diameter (Shift = radius); arc → radius",
          true,
        );
      }
      if (curveCount > 1) {
        return disabled(toolId, "Select a single circle or arc");
      }
      return disabled(toolId, "Needs a circle or arc");
    }
    case "dim-angle": {
      if (lineCount >= 2) {
        return enabled(toolId, "Angle: apply to two selected lines", true);
      }
      if (lineCount === 1) {
        return enabled(toolId, "Angle: pick a second line", false);
      }
      return disabled(toolId, "Needs two lines");
    }
    default:
      return disabled(toolId, "Not available from selection");
  }
}

/**
 * Evaluate enablement for every user-facing constraint/dimension tool.
 */
export function evaluateConstraintApplicability(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
): readonly ConstraintApplicability[] {
  const kinds = classifySelection(sketch, selectedIds);
  return CONTEXT_TOOLS.map((toolId) => evaluateOne(toolId, kinds));
}

export type SelectionConstraintAction =
  | {
      readonly kind: "apply-maintained";
      readonly request: ConstraintCreateRequest;
    }
  | {
      readonly kind: "apply-coincident";
      readonly first: ConstraintReference;
      readonly second: ConstraintReference;
    }
  | {
      readonly kind: "continue-pick";
      readonly tool: ActiveTool;
    }
  | {
      readonly kind: "disabled";
      readonly reason: string;
    };

/**
 * Build the action for a context-bar click from the current selection.
 */
export function selectionConstraintAction(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
  toolId: ActiveTool,
): SelectionConstraintAction {
  const row = evaluateConstraintApplicability(sketch, selectedIds).find(
    (item) => item.toolId === toolId,
  );
  if (row === undefined || row.state === "disabled") {
    return { kind: "disabled", reason: row?.reason ?? "Not available" };
  }
  if (!row.canApply) {
    return { kind: "continue-pick", tool: toolId };
  }

  const kinds = classifySelection(sketch, selectedIds);
  const built = buildRequestFromSelection(sketch, toolId, kinds);
  if (built === null) {
    return { kind: "continue-pick", tool: toolId };
  }
  return built;
}

function buildRequestFromSelection(
  sketch: Sketch,
  toolId: ActiveTool,
  kinds: SelectionKinds,
): SelectionConstraintAction | null {
  const lines = [...kinds.lineIds, ...kinds.axisIds];
  const points = kinds.pointIds;
  const curves = kinds.curveIds;

  if (toolId === "coincident") {
    if (points.length >= 2) {
      return {
        kind: "apply-coincident",
        first: pointRef(points[0]!),
        second: pointRef(points[1]!),
      };
    }
    if (points.length >= 1 && kinds.lineIds.length >= 1) {
      return {
        kind: "apply-coincident",
        first: pointRef(points[0]!),
        second: lineRef(kinds.lineIds[0]!),
      };
    }
    return null;
  }

  if (!isConstraintPickTool(toolId)) {
    return null;
  }

  switch (toolId) {
    case "horizontal":
    case "vertical":
      if (kinds.lineIds.length === 1) {
        return {
          kind: "apply-maintained",
          request: { type: toolId, references: [lineRef(kinds.lineIds[0]!)] },
        };
      }
      if (points.length >= 2) {
        return {
          kind: "apply-maintained",
          request: {
            type: toolId,
            references: [pointRef(points[0]!), pointRef(points[1]!)],
          },
        };
      }
      return null;
    case "parallel":
    case "perpendicular":
      if (lines.length >= 2) {
        return {
          kind: "apply-maintained",
          request: {
            type: toolId,
            references: [lineRef(lines[0]!), lineRef(lines[1]!)],
          },
        };
      }
      return null;
    case "tangent":
      if (kinds.lineIds.length >= 1 && curves.length >= 1) {
        return {
          kind: "apply-maintained",
          request: {
            type: "tangent",
            references: [lineRef(kinds.lineIds[0]!), curveRef(curves[0]!)],
          },
        };
      }
      if (curves.length >= 2) {
        return {
          kind: "apply-maintained",
          request: {
            type: "tangent",
            references: [curveRef(curves[0]!), curveRef(curves[1]!)],
          },
        };
      }
      return null;
    case "concentric":
      if (curves.length >= 2) {
        return {
          kind: "apply-maintained",
          request: {
            type: "concentric",
            references: [curveRef(curves[0]!), curveRef(curves[1]!)],
          },
        };
      }
      return null;
    case "midpoint":
      if (points.length >= 1 && kinds.lineIds.length >= 1) {
        return {
          kind: "apply-maintained",
          request: {
            type: "midpoint",
            references: [pointRef(points[0]!), lineRef(kinds.lineIds[0]!)],
          },
        };
      }
      return null;
    case "equal":
      if (kinds.lineIds.length >= 2) {
        return {
          kind: "apply-maintained",
          request: {
            type: "equal",
            references: [lineRef(kinds.lineIds[0]!), lineRef(kinds.lineIds[1]!)],
          },
        };
      }
      if (curves.length >= 2) {
        return {
          kind: "apply-maintained",
          request: {
            type: "equal",
            references: [curveRef(curves[0]!), curveRef(curves[1]!)],
          },
        };
      }
      return null;
    case "symmetric":
      if (points.length >= 2 && lines.length >= 1) {
        return {
          kind: "apply-maintained",
          request: {
            type: "symmetric",
            references: [
              pointRef(points[0]!),
              pointRef(points[1]!),
              lineRef(lines[0]!),
            ],
          },
        };
      }
      return null;
    case "point-on-object": {
      if (points.length < 1) {
        return null;
      }
      const objectId = kinds.lineIds[0] ?? curves[0];
      if (objectId === undefined) {
        return null;
      }
      return {
        kind: "apply-maintained",
        request: {
          type: "point-on-object",
          references: [pointRef(points[0]!), { entityId: objectId, role: "entity" }],
        },
      };
    }
    case "fix":
      if (points.length === 1 && kinds.lineIds.length === 0 && curves.length === 0) {
        return {
          kind: "apply-maintained",
          request: { type: "fix", references: [pointRef(points[0]!)] },
        };
      }
      if (kinds.lineIds.length === 1 && points.length === 0 && curves.length === 0) {
        return {
          kind: "apply-maintained",
          request: { type: "fix", references: [lineRef(kinds.lineIds[0]!)] },
        };
      }
      if (curves.length === 1 && points.length === 0 && kinds.lineIds.length === 0) {
        return {
          kind: "apply-maintained",
          request: { type: "fix", references: [curveRef(curves[0]!)] },
        };
      }
      return null;
    case "dim-distance": {
      if (kinds.lineIds.length === 1 && points.length === 0 && kinds.axisIds.length === 0) {
        return {
          kind: "apply-maintained",
          request: { type: "length", references: [lineRef(kinds.lineIds[0]!)] },
        };
      }
      if (points.length >= 2) {
        const request = classifyDistancePicks(
          sketch,
          { kind: "point-like", ref: pointRef(points[0]!) },
          { kind: "point-like", ref: pointRef(points[1]!) },
        );
        return request === null
          ? null
          : { kind: "apply-maintained", request };
      }
      if (points.length >= 1 && (kinds.lineIds.length >= 1 || kinds.axisIds.length >= 1)) {
        const lineId = kinds.lineIds[0] ?? kinds.axisIds[0]!;
        const request = classifyDistancePicks(
          sketch,
          { kind: "point-like", ref: pointRef(points[0]!) },
          { kind: "line", ref: lineRef(lineId) },
        );
        return request === null
          ? null
          : { kind: "apply-maintained", request };
      }
      const allLines = [...kinds.lineIds, ...kinds.axisIds];
      if (allLines.length >= 2) {
        const request = classifyDistancePicks(
          sketch,
          { kind: "line", ref: lineRef(allLines[0]!) },
          { kind: "line", ref: lineRef(allLines[1]!) },
        );
        return request === null
          ? null
          : { kind: "apply-maintained", request };
      }
      return null;
    }
    case "dim-radial": {
      if (curves.length !== 1) {
        return null;
      }
      const request = classifyRadialPick(sketch, curves[0]!);
      return request === null
        ? null
        : { kind: "apply-maintained", request };
    }
    case "dim-angle":
      if (kinds.lineIds.length >= 2) {
        return {
          kind: "apply-maintained",
          request: {
            type: "angle",
            references: [
              lineRef(kinds.lineIds[0]!),
              lineRef(kinds.lineIds[1]!),
            ],
          },
        };
      }
      return null;
    default:
      return null;
  }
}
