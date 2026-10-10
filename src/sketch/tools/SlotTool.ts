import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  slotHalfWidthFromCursor,
  slotOutlineFromCenters,
} from "../geometry/SlotMath.ts";
import {
  snapInContext,
  type ArcPreview,
  type LinePreview,
  type ToolPointerContext,
  type ToolPointerResult,
} from "./ToolTypes.ts";

export type SlotToolPhase = "idle" | "firstSet" | "secondSet";

export interface SlotToolState {
  readonly phase: SlotToolPhase;
  readonly centerA: Point2D | null;
  readonly centerB: Point2D | null;
}

export function createSlotToolState(): SlotToolState {
  return { phase: "idle", centerA: null, centerB: null };
}

export function handleSlotToolPointerDown(
  context: ToolPointerContext,
  state: SlotToolState,
): { readonly result: ToolPointerResult; readonly state: SlotToolState } {
  if (state.phase === "idle" || state.centerA === null) {
    const snapped = snapInContext(context);
    return {
      state: { phase: "firstSet", centerA: snapped.point, centerB: null },
      result: sessionPreview(snapped.point, null, snapped.point, snapped.snap),
    };
  }

  if (state.phase === "firstSet" || state.centerB === null) {
    const snapped = snapInContext(context, { alignTo: state.centerA });
    if (distance(state.centerA, snapped.point) <= TOLERANCE.coincidence) {
      return {
        state,
        result: sessionPreview(state.centerA, null, snapped.point, snapped.snap),
      };
    }
    return {
      state: {
        phase: "secondSet",
        centerA: state.centerA,
        centerB: snapped.point,
      },
      result: sessionPreview(
        state.centerA,
        snapped.point,
        snapped.point,
        snapped.snap,
      ),
    };
  }

  const snapped = snapInContext(context);
  const halfWidth = slotHalfWidthFromCursor(
    state.centerA,
    state.centerB,
    snapped.point,
  );
  if (!(halfWidth > TOLERANCE.coincidence)) {
    return {
      state,
      result: sessionPreview(
        state.centerA,
        state.centerB,
        snapped.point,
        snapped.snap,
      ),
    };
  }

  return {
    state: createSlotToolState(),
    result: {
      createSlot: {
        centerA: state.centerA,
        centerB: state.centerB,
        halfWidth,
      },
      previewPoint: null,
      previewLine: null,
      previewArc: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    },
  };
}

export function handleSlotToolPointerMove(
  context: ToolPointerContext,
  state: SlotToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.centerA === null) {
    const snapped = snapInContext(context);
    return sessionPreview(null, null, snapped.point, snapped.snap);
  }
  if (state.phase === "firstSet" || state.centerB === null) {
    const snapped = snapInContext(context, { alignTo: state.centerA });
    return sessionPreview(state.centerA, null, snapped.point, snapped.snap);
  }
  const snapped = snapInContext(context);
  return sessionPreview(state.centerA, state.centerB, snapped.point, snapped.snap);
}

export function handleSlotToolPointerLeave(
  state: SlotToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewLine: null,
    previewArc: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase !== "idle",
  };
}

export function cancelSlotToolSession(state: SlotToolState): {
  readonly state: SlotToolState;
  readonly cancelled: boolean;
} {
  if (state.phase !== "idle") {
    return { state: createSlotToolState(), cancelled: true };
  }
  return { state, cancelled: false };
}

function sessionPreview(
  centerA: Point2D | null,
  centerB: Point2D | null,
  cursor: Point2D,
  snap: ToolPointerResult["activeSnap"],
): ToolPointerResult {
  if (centerA === null) {
    return {
      previewPoint: cursor,
      previewLine: null,
      previewArc: null,
      activeSnap: snap,
      cursorWorld: cursor,
      creationSessionActive: false,
    };
  }
  if (centerB === null) {
    const line: LinePreview = { start: centerA, end: cursor };
    return {
      previewPoint: cursor,
      previewLine: line,
      previewArc: null,
      activeSnap: snap,
      cursorWorld: cursor,
      creationSessionActive: true,
    };
  }
  const halfWidth = slotHalfWidthFromCursor(centerA, centerB, cursor);
  const outline =
    halfWidth > TOLERANCE.coincidence
      ? slotOutlineFromCenters(centerA, centerB, halfWidth)
      : null;
  const previewArc: ArcPreview | null =
    outline === null
      ? null
      : {
          center: outline.arcEnd.center,
          radius: outline.arcEnd.radius,
          startAngle: outline.arcEnd.startAngle,
          endAngle: outline.arcEnd.endAngle,
          showFullCircleGuide: false,
        };
  return {
    previewPoint: cursor,
    previewLine: {
      start: outline?.lineA.start ?? centerA,
      end: outline?.lineA.end ?? centerB,
    },
    previewArc,
    activeSnap: snap,
    cursorWorld: cursor,
    creationSessionActive: true,
  };
}
