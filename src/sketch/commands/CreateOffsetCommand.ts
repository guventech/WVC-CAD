import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { SketchCommand } from "./Command.ts";
import { createLineGeometry } from "./CreateGeometryCommand.ts";

export function createAddOffsetSegmentsCommand(
  segments: readonly { readonly start: Point2D; readonly end: Point2D }[],
  options?: { readonly construction?: boolean },
): SketchCommand | null {
  if (segments.length === 0) {
    return null;
  }
  const construction = options?.construction ?? false;
  const lines: LineGeometry[] = [];
  for (const segment of segments) {
    const line = createLineGeometry(segment.start, segment.end, {
      construction,
      id: createEntityId("line"),
    });
    if (line === null) {
      return null;
    }
    lines.push(line);
  }
  const geometryIds = new Set<EntityId>(lines.map((line) => line.id));
  return {
    label:
      segments.length === 1
        ? "Offset line"
        : `Offset loop (${segments.length} edges)`,
    apply(sketch) {
      if (sketch.geometry.some((entity) => geometryIds.has(entity.id))) {
        return sketch;
      }
      return {
        ...sketch,
        geometry: [...sketch.geometry, ...lines],
      };
    },
    undo(sketch) {
      return {
        ...sketch,
        geometry: sketch.geometry.filter((entity) => !geometryIds.has(entity.id)),
      };
    },
  };
}
