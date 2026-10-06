import { hitTestSketch } from "../selection/HitTesting.ts";
import { selectEntityInSketch } from "../selection/selectInSketch.ts";
import { findFrameAxis, isDatumId } from "../model/SketchFrame.ts";
import type { MirrorAxis } from "../geometry/MirrorOps.ts";
import type { ToolPointerContext, ToolPointerResult } from "./ToolTypes.ts";

export interface MirrorRequest {
  readonly axis: MirrorAxis;
}

/**
 * Mirror tool: with a selection, click a line or world axis to mirror across.
 * Selection is read from context at click time (App passes current selection).
 */
export function handleMirrorToolPointerDown(
  context: ToolPointerContext,
): ToolPointerResult {
  if (context.selection.selectedIds.length === 0) {
    return {
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }

  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  if (hit === null) {
    return {
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }

  if (isDatumId(context.sketch.frame, hit.entityId)) {
    if (findFrameAxis(context.sketch.frame, hit.entityId) !== null) {
      return {
        mirrorRequest: {
          axis: { kind: "frame-axis", entityId: hit.entityId },
        },
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: false,
      };
    }
    return {
      selection: selectEntityInSketch(
        context.selection,
        context.sketch.constraints,
        hit.entityId,
      ),
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }

  const entity = context.sketch.geometry.find((item) => item.id === hit.entityId);
  if (entity === undefined || entity.type !== "line") {
    return {
      selection: selectEntityInSketch(
        context.selection,
        context.sketch.constraints,
        hit.entityId,
      ),
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }

  return {
    mirrorRequest: {
      axis: { kind: "line", entityId: entity.id },
    },
    activeSnap: null,
    cursorWorld: context.worldPoint,
    creationSessionActive: false,
  };
}

export function handleMirrorToolPointerMove(
  context: ToolPointerContext,
): ToolPointerResult {
  return {
    activeSnap: null,
    cursorWorld: context.worldPoint,
    creationSessionActive: false,
  };
}

export function handleMirrorToolPointerLeave(): ToolPointerResult {
  return {
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: false,
  };
}
