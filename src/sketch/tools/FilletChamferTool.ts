import { hitTestSketch } from "../selection/HitTesting.ts";
import { selectEntityInSketch } from "../selection/selectInSketch.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  previewChamferLines,
  previewFilletLines,
} from "../geometry/FilletChamferOps.ts";
import {
  arcSweepDegreesForPlan,
  type ChamferGeometryPlan,
  type FilletGeometryPlan,
} from "../geometry/FilletChamferMath.ts";
import type { ToolPointerContext, ToolPointerResult } from "./ToolTypes.ts";

export type FilletChamferMode = "fillet" | "chamfer";

export interface FilletChamferRequest {
  readonly line1Id: EntityId;
  readonly line2Id: EntityId;
  readonly pickPoint: Point2D;
}

export type FilletChamferToolPhase = "idle" | "first-line" | "sizing";

export interface FilletChamferToolState {
  readonly phase: FilletChamferToolPhase;
  readonly line1Id: EntityId | null;
  readonly line2Id: EntityId | null;
}

export function createFilletChamferToolState(): FilletChamferToolState {
  return { phase: "idle", line1Id: null, line2Id: null };
}

function pickLineId(context: ToolPointerContext): EntityId | null {
  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  if (hit === null) {
    return null;
  }
  const entity = context.sketch.geometry.find((item) => item.id === hit.entityId);
  if (entity === undefined || entity.type !== "line") {
    return null;
  }
  if (
    hit.part !== "edge" &&
    hit.part !== "endpoint-start" &&
    hit.part !== "endpoint-end"
  ) {
    return null;
  }
  return entity.id;
}

function planToPreview(
  mode: FilletChamferMode,
  plan: FilletGeometryPlan | ChamferGeometryPlan | null,
): Pick<ToolPointerResult, "previewLine" | "previewArc" | "arcSweepDegrees"> {
  if (plan === null) {
    return {
      previewLine: null,
      previewArc: null,
      arcSweepDegrees: null,
    };
  }
  if (mode === "fillet") {
    const fillet = plan as FilletGeometryPlan;
    return {
      previewLine: null,
      previewArc: {
        center: fillet.arc.center,
        radius: fillet.arc.radius,
        startAngle: fillet.arc.startAngle,
        endAngle: fillet.arc.endAngle,
        showFullCircleGuide: false,
      },
      arcSweepDegrees: arcSweepDegreesForPlan(fillet.arc),
    };
  }
  const chamfer = plan as ChamferGeometryPlan;
  return {
    previewLine: {
      start: chamfer.chamferLine.start,
      end: chamfer.chamferLine.end,
    },
    previewArc: null,
    arcSweepDegrees: null,
  };
}

function previewForState(
  mode: FilletChamferMode,
  context: ToolPointerContext,
  state: FilletChamferToolState,
): Pick<ToolPointerResult, "previewLine" | "previewArc" | "arcSweepDegrees"> {
  if (
    state.phase !== "sizing" ||
    state.line1Id === null ||
    state.line2Id === null
  ) {
    return { previewLine: null, previewArc: null, arcSweepDegrees: null };
  }
  const plan =
    mode === "fillet"
      ? previewFilletLines(
          context.sketch,
          state.line1Id,
          state.line2Id,
          context.worldPoint,
        )
      : previewChamferLines(
          context.sketch,
          state.line1Id,
          state.line2Id,
          context.worldPoint,
        );
  return planToPreview(mode, plan);
}

export function handleFilletChamferToolPointerDown(
  mode: FilletChamferMode,
  context: ToolPointerContext,
  state: FilletChamferToolState,
): { readonly state: FilletChamferToolState; readonly result: ToolPointerResult } {
  const lineId = pickLineId(context);

  if (state.phase === "sizing" && state.line1Id !== null && state.line2Id !== null) {
    const request: FilletChamferRequest = {
      line1Id: state.line1Id,
      line2Id: state.line2Id,
      pickPoint: { x: context.worldPoint.x, y: context.worldPoint.y },
    };
    const preview = previewForState(mode, context, state);
    return {
      state: createFilletChamferToolState(),
      result: {
        ...(mode === "fillet"
          ? { filletRequest: request }
          : { chamferRequest: request }),
        ...preview,
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: false,
      },
    };
  }

  if (lineId === null) {
    return {
      state,
      result: {
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: state.phase !== "idle",
      },
    };
  }

  if (state.phase === "idle") {
    return {
      state: { phase: "first-line", line1Id: lineId, line2Id: null },
      result: {
        selection: selectEntityInSketch(
          context.selection,
          context.sketch.constraints,
          lineId,
        ),
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: true,
      },
    };
  }

  if (state.phase === "first-line" && state.line1Id !== null) {
    if (lineId === state.line1Id) {
      return {
        state,
        result: {
          activeSnap: null,
          cursorWorld: context.worldPoint,
          creationSessionActive: true,
        },
      };
    }
    const next: FilletChamferToolState = {
      phase: "sizing",
      line1Id: state.line1Id,
      line2Id: lineId,
    };
    const preview = previewForState(mode, context, next);
    return {
      state: next,
      result: {
        selection: selectEntityInSketch(
          context.selection,
          context.sketch.constraints,
          lineId,
        ),
        ...preview,
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: true,
      },
    };
  }

  return {
    state,
    result: {
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: true,
    },
  };
}

export function handleFilletChamferToolPointerMove(
  mode: FilletChamferMode,
  context: ToolPointerContext,
  state: FilletChamferToolState,
): ToolPointerResult {
  const preview = previewForState(mode, context, state);
  return {
    ...preview,
    activeSnap: null,
    cursorWorld: context.worldPoint,
    creationSessionActive: state.phase !== "idle",
  };
}

export function handleFilletChamferToolPointerLeave(
  state: FilletChamferToolState,
): ToolPointerResult {
  return {
    previewLine: null,
    previewArc: null,
    arcSweepDegrees: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase !== "idle",
  };
}

export function cancelFilletChamferToolSession(
  state: FilletChamferToolState,
): { readonly state: FilletChamferToolState; readonly cancelled: boolean } {
  if (state.phase === "idle") {
    return { state, cancelled: false };
  }
  return { state: createFilletChamferToolState(), cancelled: true };
}
