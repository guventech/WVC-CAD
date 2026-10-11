import { arcMidAngle } from "../geometry/GeometryMath.ts";
import type { ArcGeometry, CircleGeometry } from "../model/Geometry.ts";

/**
 * Direction for a radius/diameter leader and label anchor.
 * Arcs (fillets) aim at the sweep midpoint so each corner points at its own arc.
 * Circles spread by constraint id to reduce overlap.
 */
export function radialDimensionAngle(
  entity: CircleGeometry | ArcGeometry,
  constraintId: string,
): number {
  if (entity.type === "arc") {
    return arcMidAngle(entity.startAngle, entity.endAngle);
  }
  return hashAngleRadians(constraintId);
}

function hashAngleRadians(constraintId: string): number {
  let hash = 0;
  for (let i = 0; i < constraintId.length; i += 1) {
    hash = (hash * 31 + constraintId.charCodeAt(i)) | 0;
  }
  return (((hash >>> 0) % 360) * Math.PI) / 180;
}
