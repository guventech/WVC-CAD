import { writeFileSync } from "node:fs";
import { createEmptySketch } from "../src/sketch/model/Sketch.ts";
import { resetEntityIdCounter } from "../src/sketch/model/EntityId.ts";
import { createAddRectangleCommand } from "../src/sketch/commands/CreateRectangleCommand.ts";
import {
  createAddCircleCommand,
  createAddLineCommand,
} from "../src/sketch/commands/CreateGeometryCommand.ts";
import { createAddSlotCommand } from "../src/sketch/commands/CreateSlotCommand.ts";
import { createAddMaintainedConstraintCommand } from "../src/sketch/commands/AddMaintainedConstraintCommand.ts";
import { createFilletCommand } from "../src/sketch/commands/FilletChamferCommand.ts";
import { createMirrorCommand } from "../src/sketch/commands/MirrorCommand.ts";
import { parseRectangleFeature } from "../src/sketch/model/RectangleFeature.ts";
import {
  parseSketchJson,
  serializeSketchToJson,
} from "../src/sketch/serialization/SketchSerializer.ts";
import {
  DATUM_AXIS_Y_ID,
  DATUM_ORIGIN_ID,
} from "../src/sketch/model/SketchFrame.ts";

function save(name, sketch) {
  const json = serializeSketchToJson(sketch, { pretty: true });
  const parsed = parseSketchJson(json);
  if (!parsed.ok) {
    throw new Error(`${name}: ${parsed.reason}`);
  }
  writeFileSync(new URL(`../public/samples/${name}`, import.meta.url), json);
  console.log(
    "wrote",
    name,
    "geometry",
    parsed.sketch.geometry.length,
    "constraints",
    parsed.sketch.constraints.length,
  );
}

resetEntityIdCounter();
let sketch = createAddRectangleCommand(
  { x: 0, y: 0 },
  { x: 100, y: 50 },
).apply(createEmptySketch({ name: "Fully constrained rectangle" }));
const feature = sketch.constraints
  .map(parseRectangleFeature)
  .find((item) => item !== null);
let add = createAddMaintainedConstraintCommand(sketch, {
  type: "coincident",
  references: [
    { entityId: feature.corners.bl, role: "start" },
    { entityId: DATUM_ORIGIN_ID, role: "position" },
  ],
});
if (add.ok) sketch = add.command.apply(sketch);
add = createAddMaintainedConstraintCommand(sketch, {
  type: "length",
  references: [{ entityId: feature.edges.bottom, role: "entity" }],
  value: 100,
});
if (add.ok) sketch = add.command.apply(sketch);
add = createAddMaintainedConstraintCommand(sketch, {
  type: "length",
  references: [{ entityId: feature.edges.left, role: "entity" }],
  value: 50,
});
if (add.ok) sketch = add.command.apply(sketch);
save("fully-constrained-rectangle.sketch.json", sketch);

resetEntityIdCounter();
sketch = createAddSlotCommand({ x: 0, y: 0 }, { x: 80, y: 0 }, 20).apply(
  createEmptySketch({ name: "Capsule slot" }),
);
save("capsule-slot.sketch.json", sketch);

resetEntityIdCounter();
sketch = createAddLineCommand({ x: 0, y: 0 }, { x: 50, y: 0 }).apply(
  createEmptySketch({ name: "Over-constrained line" }),
);
const lineId = sketch.geometry.find((entity) => entity.type === "line").id;
add = createAddMaintainedConstraintCommand(sketch, {
  type: "horizontal",
  references: [{ entityId: lineId, role: "entity" }],
});
if (add.ok) sketch = add.command.apply(sketch);
add = createAddMaintainedConstraintCommand(sketch, {
  type: "length",
  references: [{ entityId: lineId, role: "entity" }],
  value: 50,
});
if (add.ok) sketch = add.command.apply(sketch);
const overDoc = JSON.parse(serializeSketchToJson(sketch));
overDoc.constraints.push({
  id: "c-conflict-length",
  type: "length",
  references: [{ entityId: lineId, role: "entity" }],
  value: 75,
  driving: true,
});
writeFileSync(
  new URL("../public/samples/over-constrained-line.sketch.json", import.meta.url),
  `${JSON.stringify(overDoc, null, 2)}\n`,
);
console.log("wrote over-constrained-line.sketch.json (conflict fixture)");

resetEntityIdCounter();
sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 120, y: 80 }).apply(
  createEmptySketch({ name: "Filleted plate with hole" }),
);
const rectFeature = sketch.constraints
  .map(parseRectangleFeature)
  .find((item) => item !== null);
const fillet = createFilletCommand(sketch, {
  line1Id: rectFeature.edges.bottom,
  line2Id: rectFeature.edges.left,
  pickPoint: { x: 12, y: 12 },
});
if (fillet.ok) {
  sketch = fillet.command.apply(sketch);
} else {
  console.warn("fillet skipped", fillet.reason);
}
const circleCmd = createAddCircleCommand({ x: 60, y: 40 }, { x: 75, y: 40 });
if (circleCmd !== null) {
  sketch = circleCmd.apply(sketch);
}
save("filleted-plate-with-hole.sketch.json", sketch);

resetEntityIdCounter();
sketch = createAddLineCommand({ x: 10, y: 0 }, { x: 70, y: 0 }).apply(
  createEmptySketch({ name: "Mirrored bracket" }),
);
sketch = createAddLineCommand({ x: 70, y: 0 }, { x: 70, y: 45 }).apply(sketch);
const sourceIds = sketch.geometry
  .filter((entity) => entity.type === "line")
  .map((entity) => entity.id);
const mirror = createMirrorCommand(sketch, sourceIds, {
  kind: "frame-axis",
  entityId: DATUM_AXIS_Y_ID,
});
if (mirror.ok) {
  sketch = mirror.command.apply(sketch);
} else {
  console.warn("mirror skipped", mirror.reason);
}
save("mirrored-bracket.sketch.json", sketch);
