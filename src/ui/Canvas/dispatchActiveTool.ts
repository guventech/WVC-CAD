import type { MutableRefObject } from "react";
import type { SelectionState } from "../../sketch/selection/SelectionManager.ts";
import {
  isConstraintPickTool,
  type ActiveTool,
} from "../../sketch/tools/ActiveTool.ts";
import {
  handleConstraintPickToolPointerDown,
  handleConstraintPickToolPointerMove,
  type ConstraintPickToolState,
} from "../../sketch/tools/ConstraintPickTool.ts";
import {
  handleArcToolPointerDown,
  handleArcToolPointerLeave,
  handleArcToolPointerMove,
  type ArcToolState,
} from "../../sketch/tools/ArcTool.ts";
import {
  handleArc3ToolPointerDown,
  handleArc3ToolPointerLeave,
  handleArc3ToolPointerMove,
  type Arc3ToolState,
} from "../../sketch/tools/Arc3Tool.ts";
import {
  handleCircleToolPointerDown,
  handleCircleToolPointerLeave,
  handleCircleToolPointerMove,
  type CircleToolState,
} from "../../sketch/tools/CircleTool.ts";
import {
  handleCoincidentToolPointerDown,
  handleCoincidentToolPointerLeave,
  handleCoincidentToolPointerMove,
  type CoincidentToolState,
} from "../../sketch/tools/CoincidentTool.ts";
import {
  handleLineToolPointerDown,
  handleLineToolPointerLeave,
  handleLineToolPointerMove,
  type LineToolState,
} from "../../sketch/tools/LineTool.ts";
import {
  handlePointToolPointerDown,
  handlePointToolPointerLeave,
  handlePointToolPointerMove,
} from "../../sketch/tools/PointTool.ts";
import {
  handleRectangleToolPointerDown,
  handleRectangleToolPointerLeave,
  handleRectangleToolPointerMove,
  type RectangleToolState,
} from "../../sketch/tools/RectangleTool.ts";
import {
  handleSelectPointerDown,
  handleSelectPointerLeave,
  handleSelectPointerMove,
  handleSelectPointerUp,
} from "../../sketch/tools/SelectTool.ts";
import {
  handleExtendToolPointerDown,
  handleTrimExtendToolPointerLeave,
  handleTrimExtendToolPointerMove,
  handleTrimToolPointerDown,
} from "../../sketch/tools/TrimExtendTool.ts";
import {
  handleMirrorToolPointerDown,
  handleMirrorToolPointerLeave,
  handleMirrorToolPointerMove,
} from "../../sketch/tools/MirrorTool.ts";
import {
  handleFilletChamferToolPointerDown,
  handleFilletChamferToolPointerLeave,
  handleFilletChamferToolPointerMove,
  type FilletChamferToolState,
} from "../../sketch/tools/FilletChamferTool.ts";
import type {
  PointDragState,
  ToolPointerContext,
  ToolPointerResult,
} from "../../sketch/tools/ToolTypes.ts";

export type CreationToolRefs = {
  readonly lineToolRef: MutableRefObject<LineToolState>;
  readonly rectangleToolRef: MutableRefObject<RectangleToolState>;
  readonly circleToolRef: MutableRefObject<CircleToolState>;
  readonly arcToolRef: MutableRefObject<ArcToolState>;
  readonly arc3ToolRef: MutableRefObject<Arc3ToolState>;
  readonly coincidentToolRef: MutableRefObject<CoincidentToolState>;
  readonly constraintPickToolRef: MutableRefObject<ConstraintPickToolState>;
  readonly filletChamferToolRef: MutableRefObject<FilletChamferToolState>;
};

export function dispatchToolPointerDown(
  activeTool: ActiveTool,
  context: ToolPointerContext,
  refs: CreationToolRefs,
): ToolPointerResult {
  if (activeTool === "point") {
    return handlePointToolPointerDown(context);
  }
  if (activeTool === "line") {
    const handled = handleLineToolPointerDown(context, refs.lineToolRef.current);
    refs.lineToolRef.current = handled.state;
    return handled.result;
  }
  if (activeTool === "rectangle") {
    const handled = handleRectangleToolPointerDown(
      context,
      refs.rectangleToolRef.current,
    );
    refs.rectangleToolRef.current = handled.state;
    return handled.result;
  }
  if (activeTool === "circle") {
    const handled = handleCircleToolPointerDown(
      context,
      refs.circleToolRef.current,
    );
    refs.circleToolRef.current = handled.state;
    return handled.result;
  }
  if (activeTool === "arc") {
    const handled = handleArcToolPointerDown(context, refs.arcToolRef.current);
    refs.arcToolRef.current = handled.state;
    return handled.result;
  }
  if (activeTool === "arc3") {
    const handled = handleArc3ToolPointerDown(context, refs.arc3ToolRef.current);
    refs.arc3ToolRef.current = handled.state;
    return handled.result;
  }
  if (activeTool === "coincident") {
    const handled = handleCoincidentToolPointerDown(
      context,
      refs.coincidentToolRef.current,
    );
    refs.coincidentToolRef.current = handled.state;
    return handled.result;
  }
  if (activeTool === "trim") {
    return handleTrimToolPointerDown(context);
  }
  if (activeTool === "extend") {
    return handleExtendToolPointerDown(context);
  }
  if (activeTool === "mirror") {
    return handleMirrorToolPointerDown(context);
  }
  if (activeTool === "fillet") {
    const handled = handleFilletChamferToolPointerDown(
      "fillet",
      context,
      refs.filletChamferToolRef.current,
    );
    refs.filletChamferToolRef.current = handled.state;
    return handled.result;
  }
  if (activeTool === "chamfer") {
    const handled = handleFilletChamferToolPointerDown(
      "chamfer",
      context,
      refs.filletChamferToolRef.current,
    );
    refs.filletChamferToolRef.current = handled.state;
    return handled.result;
  }
  if (isConstraintPickTool(activeTool)) {
    const handled = handleConstraintPickToolPointerDown(
      activeTool,
      context,
      refs.constraintPickToolRef.current,
    );
    refs.constraintPickToolRef.current = handled.state;
    return handled.result;
  }
  return handleSelectPointerDown(context);
}

export function dispatchToolPointerMove(
  activeTool: ActiveTool,
  context: ToolPointerContext,
  refs: CreationToolRefs,
  drag: PointDragState | null,
): ToolPointerResult {
  if (drag !== null) {
    return handleSelectPointerMove(context, drag);
  }
  if (activeTool === "point") {
    return handlePointToolPointerMove(context);
  }
  if (activeTool === "line") {
    return handleLineToolPointerMove(context, refs.lineToolRef.current);
  }
  if (activeTool === "rectangle") {
    return handleRectangleToolPointerMove(
      context,
      refs.rectangleToolRef.current,
    );
  }
  if (activeTool === "circle") {
    return handleCircleToolPointerMove(context, refs.circleToolRef.current);
  }
  if (activeTool === "arc") {
    return handleArcToolPointerMove(context, refs.arcToolRef.current);
  }
  if (activeTool === "arc3") {
    return handleArc3ToolPointerMove(context, refs.arc3ToolRef.current);
  }
  if (activeTool === "coincident") {
    return handleCoincidentToolPointerMove(
      context,
      refs.coincidentToolRef.current,
    );
  }
  if (activeTool === "trim" || activeTool === "extend") {
    return handleTrimExtendToolPointerMove(context);
  }
  if (activeTool === "mirror") {
    return handleMirrorToolPointerMove(context);
  }
  if (activeTool === "fillet") {
    return handleFilletChamferToolPointerMove(
      "fillet",
      context,
      refs.filletChamferToolRef.current,
    );
  }
  if (activeTool === "chamfer") {
    return handleFilletChamferToolPointerMove(
      "chamfer",
      context,
      refs.filletChamferToolRef.current,
    );
  }
  if (isConstraintPickTool(activeTool)) {
    return handleConstraintPickToolPointerMove(
      context,
      refs.constraintPickToolRef.current,
    );
  }
  return handleSelectPointerMove(context, null);
}

export function dispatchToolPointerLeave(
  activeTool: ActiveTool,
  refs: CreationToolRefs,
  selection: SelectionState,
): ToolPointerResult {
  if (activeTool === "point") {
    return handlePointToolPointerLeave();
  }
  if (activeTool === "line") {
    return handleLineToolPointerLeave(refs.lineToolRef.current);
  }
  if (activeTool === "rectangle") {
    return handleRectangleToolPointerLeave(refs.rectangleToolRef.current);
  }
  if (activeTool === "circle") {
    return handleCircleToolPointerLeave(refs.circleToolRef.current);
  }
  if (activeTool === "arc") {
    return handleArcToolPointerLeave(refs.arcToolRef.current);
  }
  if (activeTool === "arc3") {
    return handleArc3ToolPointerLeave(refs.arc3ToolRef.current);
  }
  if (activeTool === "coincident") {
    return handleCoincidentToolPointerLeave(refs.coincidentToolRef.current);
  }
  if (activeTool === "trim" || activeTool === "extend") {
    return handleTrimExtendToolPointerLeave();
  }
  if (activeTool === "mirror") {
    return handleMirrorToolPointerLeave();
  }
  if (activeTool === "fillet" || activeTool === "chamfer") {
    return handleFilletChamferToolPointerLeave(refs.filletChamferToolRef.current);
  }
  if (isConstraintPickTool(activeTool)) {
    return {
      cursorWorld: null,
      activeSnap: null,
      creationSessionActive: refs.constraintPickToolRef.current.first !== null,
    };
  }
  return handleSelectPointerLeave(selection, null);
}

export function dispatchToolPointerUp(
  drag: PointDragState,
): ToolPointerResult {
  return handleSelectPointerUp(drag);
}
