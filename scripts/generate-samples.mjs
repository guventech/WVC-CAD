/**
 * Regenerate public/samples/*.sketch.json teaching fixtures.
 * Run: node --experimental-strip-types scripts/generate-samples.mjs
 */
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
import { addCoincidentToSketch } from "../src/sketch/commands/AddCoincidentCommand.ts";
import { createFilletCommand } from "../src/sketch/commands/FilletChamferCommand.ts";
import { parseRectangleFeature } from "../src/sketch/model/RectangleFeature.ts";
import {
  parseSketchJson,
  serializeSketchToJson,
} from "../src/sketch/serialization/SketchSerializer.ts";
import { DATUM_ORIGIN_ID } from "../src/sketch/model/SketchFrame.ts";
import { settleLoadedSketch } from "../src/sketch/constraints/ConstraintMaintenance.ts";
import { solve } from "../src/sketch/solver/Solver.ts";

function originSnap() {
  return {
    type: "origin",
    point: { x: 0, y: 0 },
    sourceEntityId: DATUM_ORIGIN_ID,
    priority: 100,
    label: "Origin",
  };
}

function mustAdd(sketch, request, label) {
  const add = createAddMaintainedConstraintCommand(sketch, request);
  if (!add.ok) {
    throw new Error(`${label}: ${add.reason}`);
  }
  return add.command.apply(sketch);
}

/** Skip when an equivalent constraint already exists (e.g. auto H/V on create). */
function tryAdd(sketch, request, label) {
  const add = createAddMaintainedConstraintCommand(sketch, request);
  if (!add.ok) {
    console.warn(`${label}: skipped — ${add.reason}`);
    return sketch;
  }
  return add.command.apply(sketch);
}

function save(name, sketch) {
  const settled = settleLoadedSketch(sketch);
  const diagnosed = solve(settled);
  const json = serializeSketchToJson(settled, { pretty: true });
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
    "status",
    diagnosed.status,
    "dof",
    diagnosed.degreesOfFreedom,
  );
  return diagnosed;
}

// —— Anchored rectangle (fully constrained) ——
resetEntityIdCounter();
let sketch = createAddRectangleCommand(
  { x: 0, y: 0 },
  { x: 100, y: 50 },
  { cornerASnap: originSnap() },
).apply(createEmptySketch({ name: "Fully constrained rectangle" }));
let feature = sketch.constraints
  .map(parseRectangleFeature)
  .find((item) => item !== null);
if (feature === null || feature === undefined) {
  throw new Error("rectangle feature missing");
}
if (
  !sketch.constraints.some(
    (c) =>
      c.type === "coincident" &&
      c.references.some((r) => r.entityId === DATUM_ORIGIN_ID),
  )
) {
  sketch = addCoincidentToSketch(
    sketch,
    { entityId: feature.corners.bl, role: "position" },
    { entityId: DATUM_ORIGIN_ID, role: "position" },
  );
}
sketch = mustAdd(
  sketch,
  {
    type: "length",
    references: [{ entityId: feature.edges.bottom, role: "entity" }],
    value: 100,
  },
  "rect width",
);
sketch = mustAdd(
  sketch,
  {
    type: "length",
    references: [{ entityId: feature.edges.left, role: "entity" }],
    value: 50,
  },
  "rect height",
);
const rectDiag = save("fully-constrained-rectangle.sketch.json", sketch);
if (rectDiag.status !== "solved" || rectDiag.degreesOfFreedom !== 0) {
  throw new Error(
    `anchored rectangle expected fully constrained, got ${rectDiag.status} dof=${rectDiag.degreesOfFreedom}`,
  );
}

// —— Capsule slot (located + sized) ——
resetEntityIdCounter();
sketch = createAddSlotCommand({ x: 0, y: 0 }, { x: 80, y: 0 }, 20).apply(
  createEmptySketch({ name: "Capsule slot" }),
);
const arcs = sketch.geometry.filter((entity) => entity.type === "arc");
const lines = sketch.geometry.filter((entity) => entity.type === "line");
if (arcs.length < 2 || lines.length < 1) {
  throw new Error("slot geometry incomplete");
}
sketch = addCoincidentToSketch(
  sketch,
  { entityId: arcs[0].id, role: "center" },
  { entityId: DATUM_ORIGIN_ID, role: "position" },
);
sketch = tryAdd(
  sketch,
  {
    type: "horizontal",
    references: [{ entityId: lines[0].id, role: "entity" }],
  },
  "slot horizontal",
);
sketch = mustAdd(
  sketch,
  {
    type: "distance",
    references: [
      { entityId: arcs[0].id, role: "center" },
      { entityId: arcs[1].id, role: "center" },
    ],
    value: 80,
  },
  "slot pitch",
);
sketch = mustAdd(
  sketch,
  {
    type: "radius",
    references: [{ entityId: arcs[0].id, role: "entity" }],
    value: 20,
  },
  "slot radius",
);
sketch = mustAdd(
  sketch,
  {
    type: "vertical-distance",
    references: [
      { entityId: DATUM_ORIGIN_ID, role: "position" },
      { entityId: arcs[1].id, role: "center" },
    ],
    value: 0,
  },
  "slot center on X",
);
save("capsule-slot.sketch.json", sketch);

// —— Over-constrained line (intentional conflict) ——
resetEntityIdCounter();
sketch = createAddLineCommand({ x: 0, y: 0 }, { x: 50, y: 0 }).apply(
  createEmptySketch({ name: "Over-constrained line" }),
);
const lineId = sketch.geometry.find((entity) => entity.type === "line").id;
sketch = tryAdd(
  sketch,
  {
    type: "horizontal",
    references: [{ entityId: lineId, role: "entity" }],
  },
  "over H",
);
sketch = mustAdd(
  sketch,
  {
    type: "length",
    references: [{ entityId: lineId, role: "entity" }],
    value: 50,
  },
  "over length 50",
);
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

// —— Filleted plate with hole (located plate + fixed hole) ——
resetEntityIdCounter();
sketch = createAddRectangleCommand(
  { x: 0, y: 0 },
  { x: 120, y: 80 },
  { cornerASnap: originSnap() },
).apply(createEmptySketch({ name: "Filleted plate with hole" }));
feature = sketch.constraints
  .map(parseRectangleFeature)
  .find((item) => item !== null);
if (feature === null || feature === undefined) {
  throw new Error("plate rectangle feature missing");
}
if (
  !sketch.constraints.some(
    (c) =>
      c.type === "coincident" &&
      c.references.some((r) => r.entityId === DATUM_ORIGIN_ID),
  )
) {
  sketch = addCoincidentToSketch(
    sketch,
    { entityId: feature.corners.bl, role: "position" },
    { entityId: DATUM_ORIGIN_ID, role: "position" },
  );
}
sketch = mustAdd(
  sketch,
  {
    type: "length",
    references: [{ entityId: feature.edges.bottom, role: "entity" }],
    value: 120,
  },
  "plate width",
);
sketch = mustAdd(
  sketch,
  {
    type: "length",
    references: [{ entityId: feature.edges.left, role: "entity" }],
    value: 80,
  },
  "plate height",
);
const fillet = createFilletCommand(sketch, {
  line1Id: feature.edges.bottom,
  line2Id: feature.edges.left,
  pickPoint: { x: 12, y: 12 },
});
if (!fillet.ok) {
  throw new Error(`fillet: ${fillet.reason}`);
}
sketch = fillet.command.apply(sketch);
const circleCmd = createAddCircleCommand({ x: 60, y: 40 }, { x: 75, y: 40 });
if (circleCmd === null) {
  throw new Error("circle create failed");
}
sketch = circleCmd.apply(sketch);
const circle = sketch.geometry.find((entity) => entity.type === "circle");
sketch = mustAdd(
  sketch,
  {
    type: "horizontal-distance",
    references: [
      { entityId: DATUM_ORIGIN_ID, role: "position" },
      { entityId: circle.id, role: "center" },
    ],
    value: 60,
  },
  "hole X",
);
sketch = mustAdd(
  sketch,
  {
    type: "vertical-distance",
    references: [
      { entityId: DATUM_ORIGIN_ID, role: "position" },
      { entityId: circle.id, role: "center" },
    ],
    value: 40,
  },
  "hole Y",
);
sketch = mustAdd(
  sketch,
  {
    type: "diameter",
    references: [{ entityId: circle.id, role: "entity" }],
    value: 30,
  },
  "hole diameter",
);
save("filleted-plate-with-hole.sketch.json", sketch);

// —— Mirrored bracket (constrained L, then mirror about Y) ——
resetEntityIdCounter();
// Constrained L-bracket (fully constrained). Mirror demo omitted — mirrored
// copies leave free DOF and were brittle for alpha teaching samples.
sketch = createAddLineCommand({ x: 0, y: 0 }, { x: 60, y: 0 }).apply(
  createEmptySketch({ name: "L-bracket" }),
);
const base = sketch.geometry.find((entity) => entity.type === "line");
sketch = addCoincidentToSketch(
  sketch,
  { entityId: base.id, role: "start" },
  { entityId: DATUM_ORIGIN_ID, role: "position" },
);
sketch = tryAdd(
  sketch,
  {
    type: "horizontal",
    references: [{ entityId: base.id, role: "entity" }],
  },
  "bracket base H",
);
sketch = mustAdd(
  sketch,
  {
    type: "length",
    references: [{ entityId: base.id, role: "entity" }],
    value: 60,
  },
  "bracket base length",
);
sketch = createAddLineCommand({ x: 60, y: 0 }, { x: 60, y: 40 }).apply(sketch);
const upright = sketch.geometry.filter((entity) => entity.type === "line").at(-1);
sketch = tryAdd(
  sketch,
  {
    type: "vertical",
    references: [{ entityId: upright.id, role: "entity" }],
  },
  "bracket upright V",
);
sketch = mustAdd(
  sketch,
  {
    type: "length",
    references: [{ entityId: upright.id, role: "entity" }],
    value: 40,
  },
  "bracket upright length",
);
const cornered = addCoincidentToSketch(
  sketch,
  { entityId: base.id, role: "end" },
  { entityId: upright.id, role: "start" },
);
if (cornered === null) {
  throw new Error("bracket corner coincident failed");
}
sketch = cornered;
const bracketDiag = save("mirrored-bracket.sketch.json", sketch);
if (bracketDiag.status !== "solved" || bracketDiag.degreesOfFreedom !== 0) {
  throw new Error(
    `L-bracket expected fully constrained, got ${bracketDiag.status} dof=${bracketDiag.degreesOfFreedom}`,
  );
}
