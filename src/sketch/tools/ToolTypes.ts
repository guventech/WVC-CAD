import type { ConstraintCreateRequest } from "../commands/AddMaintainedConstraintCommand.ts";
import { angleFromTo, distance } from "../geometry/GeometryMath.ts";
import type { GeometryDragTarget } from "../commands/GeometryDrag.ts";
import type { RectMetrics as RectMetricsType } from "../geometry/RectangleMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SelectionState } from "../selection/SelectionManager.ts";
import type { SnapCandidate } from "../selection/SnapEngine.ts";
import { findSnap } from "../selection/SnapEngine.ts";
import type { ActiveTool } from "./ActiveTool.ts";
import type { TrimExtendRequest } from "./TrimExtendTool.ts";
import type { MirrorRequest } from "./MirrorTool.ts";
import type { FilletChamferRequest } from "./FilletChamferTool.ts";
import type { Camera } from "../viewport/Camera.ts";
import { chooseGridSpacing } from "../viewport/Grid.ts";

export type RectMetrics = RectMetricsType;
export type { GeometryDragTarget };

export interface CoincidentCreateRequest {
  readonly first: ConstraintReference;
  readonly second: ConstraintReference;
}

/** Shared phase for two-click creation tools (line, rectangle, circle). */
export type TwoClickToolPhase = "idle" | "drawing";

export interface PointerModifiers {
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
}

export interface ToolPointerContext {
  readonly worldPoint: Point2D;
  readonly camera: Camera;
  readonly sketch: Sketch;
  readonly selection: SelectionState;
  readonly modifiers: PointerModifiers;
}

/** Dragging a selectable handle / geometry edit (Select tool). */
export interface PointDragState {
  readonly target: GeometryDragTarget;
  readonly originPosition: Point2D;
  readonly currentPosition: Point2D;
}

export interface LinePreview {
  readonly start: Point2D;
  readonly end: Point2D;
  /** Auto midpoint constraint: new line start ↔ this line's midpoint. */
  readonly startMidpointOf?: EntityId;
  /** Auto midpoint constraint: new line end ↔ this line's midpoint. */
  readonly endMidpointOf?: EntityId;
}

export interface PointCreateRequest {
  readonly position: Point2D;
  /** Auto midpoint constraint: new point ↔ this line's midpoint. */
  readonly midpointOf?: EntityId;
}

export interface CirclePreview {
  readonly center: Point2D;
  readonly radiusPoint: Point2D;
  /** Auto midpoint constraint: new circle center ↔ this line's midpoint. */
  readonly centerMidpointOf?: EntityId;
}

export interface RectanglePreview {
  readonly cornerA: Point2D;
  readonly cornerB: Point2D;
}

export interface ArcPreview {
  readonly center: Point2D;
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  /** When true, draw a dashed full circle guide (radius pick / degenerate sweep). */
  readonly showFullCircleGuide: boolean;
}

export interface ArcCreateRequest {
  readonly center: Point2D;
  readonly startPoint: Point2D;
  readonly endPoint: Point2D;
}

export interface LineMetrics {
  readonly lengthMm: number;
  readonly angleDegrees: number;
}

export interface ToolPointerResult {
  readonly selection?: SelectionState;
  readonly previewPoint?: Point2D | null;
  readonly previewLine?: LinePreview | null;
  readonly previewRectangle?: RectanglePreview | null;
  readonly previewCircle?: CirclePreview | null;
  readonly previewArc?: ArcPreview | null;
  readonly lineMetrics?: LineMetrics | null;
  readonly rectMetrics?: RectMetrics | null;
  readonly circleRadiusMm?: number | null;
  readonly arcSweepDegrees?: number | null;
  readonly activeSnap?: SnapCandidate | null;
  readonly cursorWorld?: Point2D | null;
  readonly createPointAt?: PointCreateRequest;
  readonly createLine?: LinePreview;
  readonly createRectangle?: RectanglePreview;
  readonly createCircle?: CirclePreview;
  readonly createArc?: ArcCreateRequest;
  readonly createCoincident?: CoincidentCreateRequest;
  readonly createConstraint?: ConstraintCreateRequest;
  readonly trimRequest?: TrimExtendRequest;
  readonly extendRequest?: TrimExtendRequest;
  readonly mirrorRequest?: MirrorRequest;
  readonly filletRequest?: FilletChamferRequest;
  readonly chamferRequest?: FilletChamferRequest;
  readonly beginPointDrag?: PointDragState;
  readonly pointDragPreview?: Point2D;
  readonly commitPointDrag?: {
    readonly target: GeometryDragTarget;
    readonly from: Point2D;
    readonly to: Point2D;
  };
  /** True while a creation tool has an unfinished gesture. */
  readonly creationSessionActive?: boolean;
}

export function resolveSnappedPoint(
  worldPoint: Point2D,
  sketch: Sketch,
  camera: Camera,
  excludeEntityIds?: readonly EntityId[],
  alignTo?: Point2D,
): { readonly point: Point2D; readonly snap: SnapCandidate | null } {
  const grid = chooseGridSpacing(camera.scale);
  const snap = findSnap(worldPoint, sketch.geometry, {
    camera,
    gridSpacingMm: grid.minorMm,
    excludeEntityIds,
    alignTo,
    frame: sketch.frame,
  });
  return {
    point: snap?.point ?? worldPoint,
    snap,
  };
}

export function snapInContext(
  context: ToolPointerContext,
  options?: {
    readonly excludeEntityIds?: readonly EntityId[];
    readonly alignTo?: Point2D;
  },
): { readonly point: Point2D; readonly snap: SnapCandidate | null } {
  return resolveSnappedPoint(
    context.worldPoint,
    context.sketch,
    context.camera,
    options?.excludeEntityIds,
    options?.alignTo,
  );
}

export function cancelTwoClickSession<T extends { readonly phase: TwoClickToolPhase }>(
  state: T,
  createIdle: () => T,
): { readonly state: T; readonly cancelled: boolean } {
  if (state.phase === "drawing") {
    return { state: createIdle(), cancelled: true };
  }
  return { state, cancelled: false };
}

export function computeLineMetrics(
  start: Point2D,
  end: Point2D,
): LineMetrics {
  return {
    lengthMm: distance(start, end),
    angleDegrees: (angleFromTo(start, end) * 180) / Math.PI,
  };
}

export function toolHint(activeTool: ActiveTool): string {
  switch (activeTool) {
    case "point":
      return "Point tool · click to place · snaps: grid / origin / endpoints · Esc to select";
    case "line":
      return "Line tool · click start · click end · continue or Esc · H/V + midpoint snaps become constraints";
    case "rectangle":
      return "Rectangle · click first corner · click opposite corner · Esc cancels · stays rectangular when corners dragged";
    case "circle":
      return "Circle · click center · click radius · Esc cancels · drag center to move · drag rim to resize";
    case "arc":
      return "Arc · center → start → end (CCW sweep) · Esc cancels · drag center to move · drag arc to resize";
    case "trim":
      return "Trim · click the portion of a line to remove (needs a crossing line or axis) · Esc to select";
    case "extend":
      return "Extend · click near a line end to grow to the nearest crossing line or axis · Esc to select";
    case "mirror":
      return "Mirror · select geometry first · click a line or world axis to mirror across · copies geometry only";
    case "fillet":
      return "Fillet · click two lines · click again to set radius (distance from corner) · Esc cancels";
    case "chamfer":
      return "Chamfer · click two lines · click again to set chamfer distance · Esc cancels";
    case "coincident":
      return "Coincident · click first point/endpoint/center · click second point or a line · Esc cancels";
    case "horizontal":
      return "Horizontal · click a line, or two points/endpoints/centers · conflicts are rejected · Esc cancels";
    case "vertical":
      return "Vertical · click a line, or two points/endpoints/centers · conflicts are rejected · Esc cancels";
    case "parallel":
      return "Parallel · click two lines (or a line and a world axis) · conflicts are rejected · Esc cancels";
    case "perpendicular":
      return "Perpendicular · click two lines (or a line and a world axis) · conflicts are rejected · Esc cancels";
    case "tangent":
      return "Tangent · click a line and a circle/arc, or two circles/arcs · Esc cancels";
    case "concentric":
      return "Concentric · click two circles or arcs · shared center · Esc cancels";
    case "midpoint":
      return "Midpoint · click a point/endpoint/center and a line · point stays at line midpoint · Esc cancels";
    case "equal":
      return "Equal · click two lines (equal length) or two circles/arcs (equal radius) · Esc cancels";
    case "symmetric":
      return "Symmetric · click two points/endpoints/centers and a mirror line or world axis · Esc cancels";
    case "point-on-object":
      return "Point on object · click a point/endpoint/center and a line/circle/arc edge · Esc cancels";
    case "fix":
      return "Fix · click a point/endpoint/center, a line, or a circle/arc · locks geometry in place · Esc cancels";
    case "dim-distance":
      return "Distance · click a line (length), or two points (H/V if aligned, else Euclidean) · Esc cancels";
    case "dim-offset-x-axis":
      return "Offset from X-axis · click a point/corner or horizontal edge · edit value to move sketch · Esc cancels";
    case "dim-offset-y-axis":
      return "Offset from Y-axis · click a point/corner or vertical edge · edit value to move sketch · Esc cancels";
    case "dim-radius":
      return "Radius dimension · click a circle or arc · edit value in Constraints panel";
    case "dim-diameter":
      return "Diameter dimension · click a circle or arc · edit value in Constraints panel";
    case "dim-angle":
      return "Angle dimension · click two lines · edit value (degrees) in Constraints panel · Esc cancels";
    default:
      return "Select · drag geometry · double-click a dimension to edit · C toggles construction · Delete · Ctrl+Z · Middle-drag pan";
  }
}
