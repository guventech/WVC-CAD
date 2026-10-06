import { midpointSourceFromSnap } from "../constraints/Midpoint.ts";
import {
  snapInContext,
  type ToolPointerContext,
  type ToolPointerResult,
} from "./ToolTypes.ts";

export function handlePointToolPointerDown(
  context: ToolPointerContext,
): ToolPointerResult {
  const snapped = snapInContext(context);
  const midpointOf = midpointSourceFromSnap(snapped.snap) ?? undefined;
  return {
    createPointAt: {
      position: snapped.point,
      ...(midpointOf !== undefined ? { midpointOf } : {}),
    },
    previewPoint: snapped.point,
    activeSnap: snapped.snap,
    cursorWorld: snapped.point,
  };
}

export function handlePointToolPointerMove(
  context: ToolPointerContext,
): ToolPointerResult {
  const snapped = snapInContext(context);
  return {
    previewPoint: snapped.point,
    activeSnap: snapped.snap,
    cursorWorld: snapped.point,
  };
}

export function handlePointToolPointerLeave(): ToolPointerResult {
  return {
    previewPoint: null,
    activeSnap: null,
    cursorWorld: null,
  };
}
