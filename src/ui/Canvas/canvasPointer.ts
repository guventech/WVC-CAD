import type { PointerEvent as ReactPointerEvent } from "react";
import type { Point2D } from "../../sketch/geometry/Point2D.ts";
import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";

export function getCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point2D {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function isPanButton(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
  return event.button === 1 || (event.button === 0 && event.altKey);
}

export function isPrimaryButton(
  event: ReactPointerEvent<HTMLCanvasElement>,
): boolean {
  return event.button === 0 && !event.altKey;
}

export function modifiersFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
  return {
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
  };
}

export function toolClassName(activeTool: ActiveTool): string {
  switch (activeTool) {
    case "point":
      return " is-point-tool";
    case "line":
      return " is-line-tool";
    case "rectangle":
      return " is-rectangle-tool";
    case "polygon":
      return " is-circle-tool";
    case "slot":
      return " is-line-tool";
    case "circle":
      return " is-circle-tool";
    case "arc":
      return " is-arc-tool";
    case "arc3":
      return " is-arc-tool";
    case "arcTangent":
      return " is-arc-tool";
    case "trim":
      return " is-trim-tool";
    case "extend":
      return " is-extend-tool";
    case "offset":
      return " is-line-tool";
    case "mirror":
      return " is-mirror-tool";
    case "fillet":
      return " is-fillet-tool";
    case "chamfer":
      return " is-chamfer-tool";
    case "coincident":
      return " is-coincident-tool";
    default:
      return "";
  }
}
