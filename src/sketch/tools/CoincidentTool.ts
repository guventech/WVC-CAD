import { hitTestSketch } from "../selection/HitTesting.ts";
import { selectEntityInSketch } from "../selection/selectInSketch.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import { constraintPickFromHit } from "../constraints/pickConstraintRef.ts";
import type { ToolPointerContext, ToolPointerResult } from "./ToolTypes.ts";

export type CoincidentToolPhase = "idle" | "first-picked";

export interface CoincidentToolState {
  readonly phase: CoincidentToolPhase;
  readonly first: ConstraintReference | null;
}

export function createCoincidentToolState(): CoincidentToolState {
  return { phase: "idle", first: null };
}

export function handleCoincidentToolPointerDown(
  context: ToolPointerContext,
  state: CoincidentToolState,
): { readonly state: CoincidentToolState; readonly result: ToolPointerResult } {
  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  if (hit === null) {
    return {
      state,
      result: {
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: state.phase !== "idle",
      },
    };
  }

  const pick = constraintPickFromHit(context.sketch, hit);
  if (pick === null) {
    return {
      state,
      result: {
        selection: selectEntityInSketch(
          context.selection,
          context.sketch.constraints,
          hit.entityId,
        ),
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: state.phase !== "idle",
      },
    };
  }

  if (state.phase === "idle") {
    if (pick.kind !== "point-like") {
      return {
        state,
        result: {
          activeSnap: null,
          cursorWorld: context.worldPoint,
          creationSessionActive: false,
        },
      };
    }
    return {
      state: { phase: "first-picked", first: pick.ref },
      result: {
        selection: selectEntityInSketch(
          context.selection,
          context.sketch.constraints,
          pick.ref.entityId,
        ),
        previewPoint: context.worldPoint,
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: true,
      },
    };
  }

  if (state.first === null) {
    return {
      state: createCoincidentToolState(),
      result: { creationSessionActive: false, activeSnap: null },
    };
  }

  return {
    state: createCoincidentToolState(),
    result: {
      createCoincident: {
        first: state.first,
        second: pick.ref,
      },
      selection: selectEntityInSketch(
        context.selection,
        context.sketch.constraints,
        pick.ref.entityId,
      ),
      previewPoint: null,
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    },
  };
}

export function handleCoincidentToolPointerMove(
  context: ToolPointerContext,
  state: CoincidentToolState,
): ToolPointerResult {
  return {
    previewPoint: state.phase === "first-picked" ? context.worldPoint : null,
    activeSnap: null,
    cursorWorld: context.worldPoint,
    creationSessionActive: state.phase !== "idle",
  };
}

export function handleCoincidentToolPointerLeave(
  state: CoincidentToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    cursorWorld: null,
    activeSnap: null,
    creationSessionActive: state.phase !== "idle",
  };
}

export function cancelCoincidentToolSession(
  state: CoincidentToolState,
): { readonly state: CoincidentToolState; readonly cancelled: boolean } {
  if (state.phase === "idle") {
    return { state, cancelled: false };
  }
  return { state: createCoincidentToolState(), cancelled: true };
}
