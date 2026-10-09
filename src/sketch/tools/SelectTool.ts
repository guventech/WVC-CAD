import {
  closestPointOnSegment,
  distance,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import {
  cornerPointIdForEdgeEndpoint,
  edgeKeyForLine,
  findRectangleFeatureForEntity,
  rectangleEntityIds,
} from "../model/RectangleFeature.ts";
import { hitTestSketch } from "../selection/HitTesting.ts";
import { isDatumId } from "../model/SketchFrame.ts";
import {
  setHovered,
  type SelectionState,
} from "../selection/SelectionManager.ts";
import { selectEntityInSketch } from "../selection/selectInSketch.ts";
import {
  excludeEntityIdsForDrag,
} from "../commands/MovePointCommand.ts";
import type { GeometryDragTarget } from "../commands/GeometryDrag.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type {
  ArcGeometry,
  CircleGeometry,
  EntityId,
  LineGeometry,
} from "../model/Geometry.ts";
import { entityHasDrivingRadiusDimension } from "../constraints/Dimensions.ts";
import {
  snapInContext,
  type PointDragState,
  type ToolPointerContext,
  type ToolPointerResult,
} from "./ToolTypes.ts";

export function handleSelectPointerDown(
  context: ToolPointerContext,
): ToolPointerResult {
  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  const hitEntity =
    hit === null
      ? undefined
      : context.sketch.geometry.find((entity) => entity.id === hit.entityId);
  const hitIsDatum =
    hit !== null && isDatumId(context.sketch.frame, hit.entityId);

  const additive =
    context.modifiers.shift || context.modifiers.ctrl || context.modifiers.meta;

  // Datums are selectable but never draggable.
  if (hitIsDatum) {
    return {
      selection: selectEntityInSketch(
        context.selection,
        context.sketch.constraints,
        hit.entityId,
        { additive },
      ),
      activeSnap: null,
      cursorWorld: context.worldPoint,
    };
  }

  if (hitEntity?.type === "point" && !additive) {
    return beginDragResult(
      context,
      { kind: "point", entityId: hitEntity.id },
      hitEntity.position,
      hitEntity.id,
    );
  }

  if (
    (hitEntity?.type === "circle" || hitEntity?.type === "arc") &&
    !additive &&
    hit !== null
  ) {
    const radialDrag = beginRadialDrag(context, hitEntity, hit.part);
    if (radialDrag !== null) {
      return radialDrag;
    }
  }

  if (hitEntity?.type === "line" && hit !== null && !additive) {
    const lineDrag = beginLineDrag(context, hitEntity, hit.part);
    if (lineDrag !== null) {
      return lineDrag;
    }
  }

  return {
    selection: selectEntityInSketch(
      context.selection,
      context.sketch.constraints,
      hit?.entityId ?? null,
      { additive },
    ),
    activeSnap: null,
    cursorWorld: context.worldPoint,
  };
}

export function handleSelectPointerMove(
  context: ToolPointerContext,
  drag: PointDragState | null,
): ToolPointerResult {
  if (drag !== null) {
    const snapped = snapInContext(context, {
      excludeEntityIds: excludeEntityIdsForDrag(context.sketch, drag.target),
    });
    return {
      pointDragPreview: snapped.point,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
    };
  }

  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  const next = setHovered(context.selection, hit?.entityId ?? null);

  return {
    selection: next !== context.selection ? next : undefined,
    activeSnap: null,
    cursorWorld: context.worldPoint,
  };
}

export function handleSelectPointerUp(
  drag: PointDragState | null,
): ToolPointerResult {
  if (drag === null) {
    return {};
  }

  return {
    commitPointDrag: {
      target: drag.target,
      from: drag.originPosition,
      to: drag.currentPosition,
    },
    activeSnap: null,
  };
}

export function handleSelectPointerLeave(
  selection: SelectionState,
  drag: PointDragState | null,
): ToolPointerResult {
  if (drag !== null) {
    return {};
  }

  const next = setHovered(selection, null);
  return {
    selection: next !== selection ? next : undefined,
    cursorWorld: null,
    activeSnap: null,
  };
}

function beginRadialDrag(
  context: ToolPointerContext,
  entity: CircleGeometry | ArcGeometry,
  part: string,
): ToolPointerResult | null {
  if (part === "center") {
    return beginDragResult(
      context,
      {
        kind: entity.type === "circle" ? "circle-center" : "arc-center",
        entityId: entity.id,
      },
      entity.center,
      entity.id,
    );
  }

  if (part === "edge") {
    // Driving radius/diameter owns size — edit via dimension, not rim drag.
    if (entityHasDrivingRadiusDimension(context.sketch, entity.id)) {
      return null;
    }
    return beginDragResult(
      context,
      {
        kind: entity.type === "circle" ? "circle-radius" : "arc-radius",
        entityId: entity.id,
      },
      pointOnCircumference(entity.center, entity.radius, context.worldPoint),
      entity.id,
    );
  }

  return null;
}

/** Project `toward` onto the circle of `radius` around `center`. */
function pointOnCircumference(
  center: Point2D,
  radius: number,
  toward: Point2D,
): Point2D {
  const dist = distance(center, toward);
  if (dist <= TOLERANCE.coincidence) {
    return { x: center.x + radius, y: center.y };
  }
  const scale = radius / dist;
  return {
    x: center.x + (toward.x - center.x) * scale,
    y: center.y + (toward.y - center.y) * scale,
  };
}

function beginLineDrag(
  context: ToolPointerContext,
  line: LineGeometry,
  part: "endpoint-start" | "endpoint-end" | "edge" | string,
): ToolPointerResult | null {
  const feature = findRectangleFeatureForEntity(
    context.sketch.constraints,
    line.id,
  );

  if (feature !== null) {
    if (part === "endpoint-start" || part === "endpoint-end") {
      const which = part === "endpoint-start" ? "start" : "end";
      const cornerId = cornerPointIdForEdgeEndpoint(feature, line.id, which);
      if (cornerId === null) {
        return null;
      }
      const corner = context.sketch.geometry.find(
        (entity) => entity.id === cornerId,
      );
      if (corner?.type !== "point") {
        return null;
      }
      return beginDragResult(
        context,
        { kind: "point", entityId: cornerId },
        corner.position,
        cornerId,
      );
    }

    if (part === "edge") {
      const edge = edgeKeyForLine(feature, line.id);
      if (edge === null) {
        return null;
      }
      return beginDragResult(
        context,
        { kind: "rectangle-edge", entityId: line.id, edge },
        context.worldPoint,
        line.id,
      );
    }

    return null;
  }

  if (part === "endpoint-start" || part === "endpoint-end") {
    const which = part === "endpoint-start" ? "start" : "end";
    const origin = which === "start" ? line.start : line.end;
    return beginDragResult(
      context,
      { kind: "line-endpoint", entityId: line.id, which },
      origin,
      line.id,
    );
  }

  if (part === "edge") {
    const grab = closestPointOnSegment(context.worldPoint, line.start, line.end);
    const target: GeometryDragTarget = {
      kind: "line-body",
      entityId: line.id,
      grabOffset: {
        x: grab.x - line.start.x,
        y: grab.y - line.start.y,
      },
      span: {
        x: line.end.x - line.start.x,
        y: line.end.y - line.start.y,
      },
    };
    return beginDragResult(context, target, grab, line.id);
  }

  return null;
}

function beginDragResult(
  context: ToolPointerContext,
  target: GeometryDragTarget,
  originPosition: Point2D,
  selectEntityId: EntityId,
): ToolPointerResult {
  const feature = findRectangleFeatureForEntity(
    context.sketch.constraints,
    selectEntityId,
  );
  const selection =
    feature !== null
      ? {
          ...context.selection,
          selectedIds: [...rectangleEntityIds(feature)],
        }
      : selectEntityInSketch(
          context.selection,
          context.sketch.constraints,
          selectEntityId,
        );

  return {
    selection,
    beginPointDrag: {
      target,
      originPosition,
      currentPosition: originPosition,
    },
    activeSnap: null,
    cursorWorld: context.worldPoint,
  };
}
