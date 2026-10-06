import type { Geometry } from "../model/Geometry.ts";

/** Construction/reference entities are excluded from future solid-profile loops. */
export function isConstructionGeometry(entity: Geometry): boolean {
  return entity.construction;
}

/** Geometry eligible for closed-profile detection (Chunk 23). */
export function listSolidProfileGeometry(
  geometry: readonly Geometry[],
): Geometry[] {
  return geometry.filter((entity) => !isConstructionGeometry(entity));
}
