import { resetEntityIdCounter } from "../model/EntityId.ts";
import type { Sketch } from "../model/Sketch.ts";

/**
 * Advance the entity-id serial past any numeric suffixes in the sketch
 * so newly created ids do not collide after load.
 */
export function syncEntityIdCounterFromSketch(sketch: Sketch): void {
  let maxSerial = 0;

  const consider = (id: string): void => {
    const match = /-(\d+)$/.exec(id);
    if (match === null) {
      return;
    }
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > maxSerial) {
      maxSerial = value;
    }
  };

  for (const entity of sketch.geometry) {
    consider(entity.id);
  }
  for (const constraint of sketch.constraints) {
    consider(constraint.id);
  }

  resetEntityIdCounter(maxSerial + 1);
}
