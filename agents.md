# AGENTS.md — Parametric 2D Mechanical Sketcher

## Living project docs (read these first for current status)

| File | Role |
|------|------|
| [PROGRESS.md](./PROGRESS.md) | Completed chunks, current work, architecture-review issues |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layer boundaries, folders, coordinates, solver honesty |
| [DECISIONS.md](./DECISIONS.md) | ADRs (model ownership, units, commands, tools, queries) |
| [TEST_PLAN.md](./TEST_PLAN.md) | Tolerances, unit coverage, fixtures, E2E plan |
| [README.md](./README.md) | How to run and use the app |

**Agent rule:** Before coding, read PROGRESS.md and ARCHITECTURE.md. Do not invent status from this file alone — the chunk plan below is the roadmap; PROGRESS.md is the live checklist.

**Current gate:** Chunks 0–27 and Pre–Chunk 16 (World Datum Frame) are complete — see PROGRESS.md. Prefer Tauri 2 (not Electron) for the eventual Windows installer; do not scaffold packaging mid-chunk unless asked.

# Architecture Preservation Rules

Before implementing any new chunk:

1. Inspect the existing architecture.
2. Reuse existing abstractions where appropriate.
3. Do not duplicate geometry mathematics.
4. Do not move CAD logic into UI components.
5. Do not make React state the source of truth.
6. Do not introduce renderer-specific types into the domain model.
7. Do not introduce a dependency without explaining its purpose.
8. Do not perform broad refactoring unless explicitly requested.
9. Do not modify completed functionality without regression tests.
10. Preserve public/internal model interfaces once established unless there is a documented reason to change them.

Before declaring a chunk complete:

1. Typecheck.
2. Run unit tests.
3. Run build.
4. Run relevant E2E tests.
5. Perform a manual smoke test.
6. Update PROGRESS.md.
7. Update ARCHITECTURE.md if architecture changed.
8. Update DECISIONS.md if an architectural decision was made.

---

## 0. Project mission

Build a focused desktop/web CAD **2D sketching application**:

- Core workflow: create 2D mechanical geometry, then progressively constrain it.
- Important: this project is **only the sketcher** for now.
- Do **not** implement extrusion, pads, pockets, revolutions, boolean solids, STEP generation, STL generation, or a 3D solid kernel in the first phase.
- The architecture must make those capabilities possible later as independent modules.

The application should feel like a small, engineering-oriented parametric sketcher rather than a generic drawing application.

The core mental model is:

> Create approximate geometry → detect relationships → add constraints → solve the sketch → diagnose remaining degrees of freedom → edit dimensions → verify the geometry.

The same broad workflow applies throughout: create 2D geometry, use construction geometry, apply geometrical and dimensional constraints, analyze under/over-constrained sketches, and eventually use the sketch as input to downstream 3D features.

## 1. Product principles

### 1.1 Engineering correctness beats visual polish

A sketch that looks correct but has incorrect constraints is a failure.

Prioritize:

1. Geometric correctness
2. Constraint correctness
3. Solver stability
4. Deterministic behavior
5. Undo/redo reliability
6. Selection/editing usability
7. Visual polish

### 1.2 Parametric-first architecture

Do not store the sketch merely as pixels or SVG paths.

The source of truth must be a structured parametric model:

- geometry entities
- construction/reference status
- constraints
- dimensions
- dependencies
- coordinate system
- solver state
- metadata

Rendering is a view of that model.

The following are never allowed to become the source of truth:

- Canvas pixels
- SVG paths
- screen coordinates
- React component state
- rendered geometry
- temporary previews

The source of truth is always the Sketch model in world coordinates.

### 1.3 Never fake solver behavior

Do not implement a fake "fully constrained" indicator based only on the number of dimensions.

The solver must determine whether:

- the sketch is under-constrained
- fully constrained
- over-constrained
- inconsistent/unsolvable

If a true mathematical solver is not yet implemented, clearly isolate the provisional solver and label the capability as incomplete. Do not hide limitations.

### 1.4 Build in small vertical slices

Every chunk must produce something runnable.

Never ask a coding agent to "build the whole CAD application."

Each chunk should:

1. inspect the current repository
2. make one small change
3. run tests
4. run the application
5. manually verify the acceptance criteria
6. report files changed
7. report known limitations
8. stop

---

# 2. Recommended architecture

Use a modular TypeScript application.

Preferred stack:

- React
- TypeScript
- Vite
- HTML Canvas or SVG for the first 2D renderer
- Zustand or an equivalent small state-management layer
- Vitest for unit tests
- Playwright for end-to-end tests
- A dedicated geometry/model layer independent from React
- A dedicated constraint/solver layer independent from React
- A command/history layer independent from React

Do not put engineering calculations directly inside React components.

Recommended high-level structure:

```text
src/
  app/
    App.tsx
    routes/
  ui/
    TopToolbar/
    GeometryToolbar/
    ConstraintToolbar/
    Canvas/
    PropertiesPanel/
    ConstraintPanel/
    StatusBar/
    Dialogs/
  sketch/
    model/
      Sketch.ts
      Geometry.ts
      Constraint.ts
      CoordinateSystem.ts
      SketchSettings.ts
    geometry/
      Point2D.ts
      Vector2D.ts
      Line2D.ts
      Circle2D.ts
      Arc2D.ts
      GeometryMath.ts
      Intersections.ts
      Projections.ts
      BoundingBox.ts
    constraints/
      ConstraintTypes.ts
      ConstraintGraph.ts
      ConstraintValidator.ts
      DegreesOfFreedom.ts
    solver/
      Solver.ts
      Residuals.ts
      Jacobian.ts
      SolverResult.ts
    commands/
      Command.ts
      CreateGeometryCommand.ts
      DeleteGeometryCommand.ts
      AddConstraintCommand.ts
      EditDimensionCommand.ts
      ToggleConstructionCommand.ts
    selection/
      SelectionManager.ts
      HitTesting.ts
      SnapEngine.ts
    serialization/
      SketchSerializer.ts
      SketchSchema.ts
    analysis/
      SketchDiagnostics.ts
      ProfileAnalyzer.ts
  tests/
    geometry/
    constraints/
    solver/
    commands/
    e2e/
```

Future modules must be able to consume the sketch without knowing anything about React:

```text
Sketch
  ↓
SketchValidator
  ↓
ProfileAnalyzer
  ↓
Future 3D Feature Module
  ↓
Future CAD Kernel / STEP / STL Module
```

---

# 3. The canonical data model

Create a stable internal JSON representation from the beginning.

Example:

```ts
type EntityId = string;
type ConstraintId = string;

interface Point2D {
  x: number;
  y: number;
}

interface LineGeometry {
  id: EntityId;
  type: "line";
  start: Point2D;
  end: Point2D;
  construction: boolean;
}

interface CircleGeometry {
  id: EntityId;
  type: "circle";
  center: Point2D;
  radius: number;
  construction: boolean;
}

interface ArcGeometry {
  id: EntityId;
  type: "arc";
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  construction: boolean;
}

type Geometry = LineGeometry | CircleGeometry | ArcGeometry;

interface Sketch {
  id: string;
  name: string;
  units: "mm";
  geometry: Geometry[];
  constraints: Constraint[];
  settings: SketchSettings;
  version: number;
}
```

Do not expose renderer-specific objects in this model.

For example, avoid storing:

```ts
Path2D
CanvasRenderingContext2D
DOMRect
React components
```

inside the sketch model.

---

# 4. Coordinate system

Use one consistent engineering coordinate system.

Requirements:

- world coordinates are Cartesian
- X increases to the right
- Y increases upward
- origin is `(0,0)`
- internal units are millimetres
- screen coordinates are converted through a camera transform
- zoom must never change model dimensions
- panning must never modify model coordinates

Create:

```ts
worldToScreen(point)
screenToWorld(point)
```

and test them heavily.

Acceptance tests:

- `(0,0)` maps to the origin on screen
- converting world → screen → world returns approximately the original point
- zooming does not alter geometry coordinates
- panning does not alter geometry coordinates

---

# 5. Chunk plan

## CHUNK 0 — Repository foundation

### Goal

Create the smallest runnable application.

### Build

- React + TypeScript + Vite
- application shell
- empty sketch canvas
- toolbar placeholder
- status bar
- test infrastructure
- linting/type checking

### Checks

```bash
npm run build
npm run test
npm run lint
```

### Success criteria

- application starts without errors
- TypeScript has no errors
- test runner works
- browser console has no application errors
- repository structure matches the architecture above

Do not proceed if the foundation is unstable.

---

# CHUNK 1 — 2D viewport and camera

### Goal

Create a CAD-like infinite 2D working area.

### Build

- canvas
- world coordinate system
- pan
- zoom
- zoom around mouse cursor
- X/Y axes
- origin marker
- optional grid
- scale-aware grid spacing

### Grid behavior

The grid should adapt to zoom.

Example:

```text
zoomed out:
100 mm
50 mm
10 mm

zoomed in:
10 mm
5 mm
1 mm
0.5 mm
```

Do not use arbitrary screen-pixel grid spacing.

### Checks

- zoom centered on cursor
- pan works with middle mouse or configured equivalent
- coordinates remain unchanged after camera operations
- axes remain perpendicular
- origin remains mathematically correct

### Success criteria

A user can navigate an apparently infinite 2D engineering workspace without losing the origin.

---

# CHUNK 2 — Selection and hit testing

### Goal

Make geometry selectable.

### Build

- single selection
- multi-selection
- deselection
- selection highlight
- hover highlight
- hit testing
- selection priority
- click tolerance in screen space

Hit testing must account for zoom.

### Required tests

Test selection for:

- line
- circle
- arc
- endpoint
- center point
- overlapping geometry
- very zoomed-in geometry
- very zoomed-out geometry

### Success criteria

The user can reliably select geometry regardless of zoom level.

---

# CHUNK 3 — Point tool

### Goal

Create the first actual sketch entity.

### Build

- point creation
- coordinate display
- point selection
- point deletion
- point movement

### Snap candidates

Start with:

- grid
- origin
- existing endpoints

Do not implement every snap type yet.

### Success criteria

A point can be created at an exact world coordinate and remains exact after zoom/pan.

---

# CHUNK 4 — Line tool

### Goal

Implement the fundamental mechanical sketch entity.

### UX

A line command should support:

1. click start
2. move cursor
3. preview line
4. click end
5. continue drawing or finish with Escape

Display:

- X coordinate
- Y coordinate
- length
- angle

### Smart inference

During creation detect:

- horizontal
- vertical
- coincident with existing point
- point on origin
- grid snap

Show temporary inference indicators.

Do not permanently create every detected inference unless the user confirms or the application is configured for automatic constraints.

### Success criteria

User can create accurate lines rapidly without manually entering coordinates.

---

# CHUNK 5 — Rectangle tool

### Goal

Create a proper parametric rectangle as a convenience operation.

A rectangle should not simply create four unrelated lines.

It should create:

- 4 lines
- 4 coincident corner relationships
- 2 horizontal constraints
- 2 vertical constraints

The exact constraint strategy may evolve, but the rectangle must behave as one coherent parametric feature.

### Checks

Dragging one corner must preserve:

- closed topology
- horizontal edges
- vertical edges
- corner coincidence

### Success criteria

Rectangle remains a rectangle when edited.

---

# CHUNK 6 — Circle tool

### Goal

Implement circles.

Support:

- center + radius
- center snapping
- radius preview
- radius dimension later

### Checks

- radius cannot become negative
- zero radius must be rejected
- hit testing must distinguish center from circumference
- moving the center must preserve radius

### Success criteria

Circles remain geometrically valid after editing and camera operations.

---

# CHUNK 7 — Arc tool

### Goal

Implement arcs robustly.

Start with:

- center-point arc

Then add:

- three-point arc
- tangent arc

### Important

Do not represent an arc merely as a polyline approximation.

Store:

```text
center
radius
startAngle
endAngle
```

### Checks

- clockwise/counter-clockwise handling
- angle wrapping
- arcs crossing 0°
- small arcs
- nearly full circles
- hit testing
- rendering

### Success criteria

Arc geometry remains mathematically stable during editing.

---

# CHUNK 8 — Construction geometry

### Goal

Support construction/reference geometry.

Construction geometry:

- is visible
- is selectable
- can participate in constraints
- is normally excluded from future closed-profile generation

Visual distinction should be clear.

### Commands

- toggle construction
- create geometry directly as construction

### Checks

A future profile analyzer must ignore construction geometry when identifying solid profiles.

---

# CHUNK 9 — Snap and inference engine

### Goal

Build a dedicated inference engine.

Potential snap/inference types:

- grid
- origin
- endpoint
- midpoint
- center
- intersection
- horizontal
- vertical
- perpendicular
- parallel
- tangent
- coincident
- point-on-entity

The snap engine dynamically detects relationships such as alignment, parallelism, perpendicularity, tangency, concentricity, horizontal/vertical relationships and midpoint relationships.

Implement only a small subset initially.

### Architecture

```ts
interface SnapCandidate {
  type: SnapType;
  point: Point2D;
  sourceEntityId?: string;
  priority: number;
}
```

The snap engine must be independent from rendering.

### Success criteria

The same snap logic can later be reused by:

- line tool
- circle tool
- arc tool
- dimension tool
- future spline tool

---

# CHUNK 10 — Constraint data model

### Goal

Create the foundation for true parametric sketching.

Start with:

### Geometric constraints

- Coincident
- Horizontal
- Vertical
- Parallel
- Perpendicular
- Tangent
- Concentric
- Equal
- Midpoint
- Point-on-object
- Symmetric
- Fix/Lock

### Dimensional constraints

- horizontal distance
- vertical distance
- distance
- line length
- radius
- diameter
- angle
- X coordinate
- Y coordinate

Do not implement all constraints in one coding task.

---

# CHUNK 11 — Coincident constraint

### Goal

Implement the first real geometric constraint.

Examples:

```text
line.start ↔ line.end
line.start ↔ circle.center
point ↔ line
```

### Checks

If two endpoints are coincident:

- moving one must move/solve the other
- they must remain coincident within solver tolerance
- deleting an entity must remove invalid dependent constraints

### Success criteria

Coincident constraints survive editing and serialization.

---

# CHUNK 12 — Horizontal and vertical constraints

### Goal

Implement orientation constraints.

### Checks

For horizontal:

```text
abs(y1 - y2) < tolerance
```

For vertical:

```text
abs(x1 - x2) < tolerance
```

### Success criteria

Dragging geometry cannot produce a visibly non-horizontal/vertical entity when constrained.

---

# CHUNK 13 — Dimensional constraints

### Goal

Allow dimensions to drive geometry.

Start with:

1. line length
2. horizontal distance
3. vertical distance
4. radius
5. diameter
6. angle

A dimension must be represented as a constraint, not merely as annotation text.

Example:

```ts
{
  id: "c12",
  type: "distance",
  references: [
    { entityId: "line1", point: "start" },
    { entityId: "line1", point: "end" }
  ],
  value: 50,
  driving: true
}
```

### Critical distinction

Support:

- driving dimensions
- reference/measurement dimensions

A reference dimension reports geometry but does not control it.

---

# CHUNK 14 — Constraint solver

### Goal

Replace ad-hoc movement logic with a real constraint-solving architecture.

The solver should conceptually solve:

```text
find X such that F(X) = 0
```

where:

- X = geometric parameters
- F = constraint residuals

For example:

Horizontal:

```text
y1 - y2 = 0
```

Coincident:

```text
x1 - x2 = 0
y1 - y2 = 0
```

Distance:

```text
sqrt((x2-x1)^2 + (y2-y1)^2) - L = 0
```

### Important

Do not let a coding agent invent a solver without tests.

The solver must have:

- deterministic inputs
- deterministic outputs
- tolerance configuration
- iteration limit
- convergence criteria
- failure diagnostics

A numerical method such as Newton-Raphson or Levenberg-Marquardt may be used, but the implementation should remain behind a solver interface so it can be replaced later.

### Solver API

```ts
interface Solver {
  solve(sketch: Sketch, options?: SolverOptions): SolverResult;
}
```

### SolverResult

Must include:

```ts
status:
  "solved"
  | "under-constrained"
  | "over-constrained"
  | "inconsistent"
  | "failed"

iterations: number
residual: number
degreesOfFreedom: number
conflictingConstraints: ConstraintId[]
warnings: string[]
```

---

# CHUNK 15 — Degrees of freedom

### Goal

Give the user engineering feedback.

The application should distinguish:

- under-constrained
- fully constrained
- over-constrained
- inconsistent

### UI

Show a status such as:

```text
UNDER-CONSTRAINED — 4 DOF
```

or:

```text
FULLY CONSTRAINED
```

or:

```text
OVER-CONSTRAINED
```

Do not rely only on color.

Use text plus visual indication.

### Success criteria

Simple test sketches produce predictable DOF counts.

Example:

A free 2D point normally has:

```text
2 DOF
```

A free line endpoint pair normally has:

```text
4 DOF
```

before constraints.

The exact implementation must account for entity parameterization and constraints.

---

# CHUNK 16 — Over-constraint detection

### Goal

Prevent impossible or redundant constraint systems.

Examples:

- line horizontal + line vertical
- two different fixed lengths on the same line
- incompatible coincident constraints
- radius 10 + radius 20 on same circle

### UX

When a constraint causes failure:

- identify the newly added constraint
- explain why it cannot be accepted
- offer cancel/remove
- do not corrupt the sketch

### Success criteria

A failed constraint operation leaves the previous valid sketch unchanged.

This is extremely important.

---

# CHUNK 17 — Under-constrained visualization

### Goal

Make remaining degrees of freedom understandable.

Potential visualization:

- free endpoints highlighted
- draggable DOF markers
- status bar
- diagnostic panel

The user should be able to understand:

> "This rectangle can still move horizontally."

rather than merely seeing:

> "4 DOF."

---

# CHUNK 18 — Dimension editing

### Goal

Make dimensions behave like CAD dimensions.

Double-click a dimension:

```text
50 mm
```

User changes to:

```text
75 mm
```

The solver updates the geometry.

### Checks

- invalid numeric input rejected
- negative length rejected where inappropriate
- zero radius rejected
- unit parsing isolated
- undo restores previous value
- redo reapplies new value

---

# CHUNK 19 — Trim and extend

### Goal

Implement basic CAD editing operations.

Start with:

- trim
- extend

Later:

- break
- split
- fillet
- chamfer
- mirror
- offset

### Important

Operations must update the parametric model rather than merely modify rendered paths.

### Checks

After trimming:

- topology remains valid
- constraints referencing removed geometry are handled
- undo restores original geometry

---

# CHUNK 20 — Mirror

### Goal

Implement symmetry operations.

Start with:

- mirror geometry about horizontal axis
- mirror geometry about vertical axis
- mirror about construction line

Preserve meaningful constraints where possible.

Do not duplicate broken constraints blindly.

---

# CHUNK 21 — Fillet and chamfer

Implement only after basic geometry and solver are reliable.

### Fillet

Given two intersecting entities:

- trim original entities
- create arc
- establish tangent relationships
- preserve meaningful coincidence

### Chamfer

Given two intersecting entities:

- trim
- create connecting line
- preserve topology

These operations are high-risk and should have extensive geometry tests.

---

# CHUNK 22 — Sketch diagnostics

### Goal

Create a professional analysis panel.

Diagnostics should detect:

- open profiles
- disconnected endpoints
- self-intersections
- duplicate geometry
- zero-length lines
- zero-radius circles
- invalid arcs
- conflicting constraints
- redundant constraints
- unconstrained geometry
- construction geometry included in a profile
- non-manifold profile chains

Example:

```text
Sketch Analysis

Geometry
✓ 8 valid entities
✓ 1 construction entity
⚠ 1 open endpoint

Constraints
✓ 11 valid constraints
⚠ 2 remaining DOF

Profiles
✗ No closed profile detected
```

---

# CHUNK 23 — Closed-profile detection

### Goal

Prepare for future 3D modules.

The profile analyzer must identify:

- closed outer loops
- inner loops/holes
- open geometry
- construction geometry
- self-intersections

Return structured data:

```ts
interface ProfileLoop {
  entityIds: EntityId[];
  closed: boolean;
  orientation: "CW" | "CCW";
  area: number;
  parentLoopId?: string;
}
```

Do not generate a 3D solid yet.

This module is the bridge to future Pad/Pocket/Revolve modules.

---

# CHUNK 24 — Undo/redo command system

### Goal

Every user action must be reversible.

Use commands such as:

```text
CreateLineCommand
DeleteGeometryCommand
AddConstraintCommand
DeleteConstraintCommand
ChangeDimensionCommand
ToggleConstructionCommand
TrimCommand
MirrorCommand
```

Every command needs:

```ts
execute()
undo()
```

Do not implement undo by saving random screenshots of application state.

The command system should operate on the parametric model.

---

# CHUNK 25 — Save/load

### Goal

Save sketches as a versioned JSON format.

Example:

```text
my-part.sketch.json
```

Include:

- schema version
- units
- geometry
- constraints
- settings
- metadata

Example:

```json
{
  "schemaVersion": 1,
  "units": "mm",
  "geometry": [],
  "constraints": []
}
```

### Checks

- save
- reload
- geometry identical
- constraints identical
- solver result equivalent
- undo history may intentionally reset after loading

Never silently change model units during serialization.

---

# CHUNK 26 — Autosave and recovery

Implement:

- local autosave
- crash recovery
- "unsaved changes" indicator

Do not overwrite the primary user file without a recovery strategy.

---

# CHUNK 27 — CAD-like UI refinement

Only after the engineering core is stable.

UI should include:

```text
┌─────────────────────────────────────────────┐
│ File | Edit | Sketch | Constraints | Tools │
├─────────────────────────────────────────────┤
│ Geometry toolbar                            │
├───────────────┬─────────────────────────────┤
│ Geometry      │                             │
│ Constraints   │       2D SKETCH             │
│ Properties    │                             │
│               │                             │
├───────────────┴─────────────────────────────┤
│ X: 25.2  Y: 14.8 | 3 DOF | mm | Ready     │
└─────────────────────────────────────────────┘
```

Avoid copying proprietary CAD visual design, icons, logos, or UI assets from other products.

The goal is an original engineering sketcher UI, not visual duplication.

---

# 6. Geometry requirements

## Initial geometry

Implement in this order:

1. Point
2. Line
3. Circle
4. Arc
5. Rectangle
6. Construction line
7. Polygon
8. Spline

Do not start with spline.

Spline support is significantly more complex and can destabilize the solver architecture.

---

# 7. Constraint implementation order

Implement constraints in this order:

### Tier 1

- Coincident
- Horizontal
- Vertical
- Distance
- Radius
- Diameter

### Tier 2

- Parallel
- Perpendicular
- Tangent
- Concentric
- Midpoint

### Tier 3

- Equal
- Symmetric
- Angle
- Point-on-object
- Fix

### Tier 4

- advanced reference constraints
- driven/reference dimensions
- constraint groups
- equations/parameters

Never move to the next tier until the previous tier has automated tests.

---

# 8. Testing strategy

Testing is mandatory because vibe coding can produce plausible-looking but mathematically incorrect CAD behavior.

## Unit tests

Test:

- vector mathematics
- distance
- angle
- intersections
- projection
- bounding boxes
- hit testing
- constraint residuals
- solver convergence
- serialization

## Property-based tests

Where practical, generate random valid geometry.

Examples:

- distance is symmetric
- world→screen→world approximately returns original coordinates
- serialization→deserialization preserves geometry
- mirroring twice returns the original geometry
- undo→redo returns equivalent model state

## Integration tests

Test complete workflows:

```text
Create line
→ constrain horizontal
→ set length
→ solve
→ save
→ reload
→ solve again
```

## End-to-end tests

Use Playwright for:

- create sketch
- create rectangle
- add dimensions
- edit dimensions
- undo
- redo
- save
- reload

---

# 9. Mandatory regression sketches

Create a permanent test fixture library.

## Fixture A — Free line

Expected:

```text
4 DOF
```

before constraints.

## Fixture B — Horizontal line

Expected:

```text
3 DOF
```

assuming endpoints remain otherwise free.

## Fixture C — Fixed rectangle

Create:

```text
100 x 50 mm
```

Anchor one corner to origin.

Expected:

```text
FULLY CONSTRAINED
```

## Fixture D — Circle

Create:

```text
R = 20 mm
```

Anchor center to origin.

Expected:

```text
FULLY CONSTRAINED
```

## Fixture E — Over-constrained line

Apply incompatible constraints.

Expected:

```text
OVER-CONSTRAINED / INCONSISTENT
```

and the application must reject or safely roll back the invalid operation.

## Fixture F — Open profile

Create three connected lines.

Expected:

```text
OPEN PROFILE
```

## Fixture G — Hole

Create outer circle and inner circle.

Expected:

```text
OUTER LOOP + INNER LOOP
```

This will later support a Pad/Pocket module.

---

# 10. Performance targets

The initial application should comfortably support:

- 100 geometry entities
- 500 geometry entities
- 1,000 constraints

without obvious interaction lag.

Do not prematurely optimize.

First profile:

- pointer movement
- rendering
- hit testing
- solver

Only optimize the actual bottleneck.

---

# 11. Numerical robustness

Use a centralized tolerance configuration.

Example:

```ts
const TOLERANCE = {
  geometric: 1e-7,
  display: 1e-4,
  coincidence: 1e-6,
  solverResidual: 1e-8,
};
```

Do not scatter random tolerances throughout the code.

Never compare floating-point values using:

```ts
a === b
```

for geometric equality.

Use a tolerance function:

```ts
isApproximatelyEqual(a, b, tolerance)
```

---

# 12. Error-handling rules

The application must never silently corrupt a sketch.

If an operation fails:

1. preserve the previous valid model
2. show a concise error
3. identify the failed operation
4. allow the user to continue
5. log technical details for debugging

Example:

```text
Constraint could not be added.

The new distance constraint conflicts with
existing constraints.

No changes were made.
```

---

# 13. Vibe-coding rules for the coding agent

The coding agent must follow these rules.

## Rule 1 — Inspect before modifying

Before writing code:

- inspect repository
- identify current architecture
- identify existing tests
- identify package manager
- identify current scripts
- avoid replacing working infrastructure

## Rule 2 — One chunk at a time

Never implement multiple major chunks in one request.

## Rule 3 — No speculative dependencies

Do not install a library because it "might be useful."

Before adding a dependency:

- explain why
- verify it solves a specific problem
- check whether existing code can solve it
- add the smallest dependency possible

## Rule 4 — No giant files

Prefer small, focused modules. Use this guide when reviewing file size:

| File size  | Action                              |
| ---------- | ----------------------------------- |
| <250 lines | Fine                                |
| 250–400    | Watch it                            |
| 400–600    | Consider splitting                  |
| >600       | Strongly consider splitting         |
| >1,000     | Almost certainly wrong architecture |

Do not create:

```text
Sketcher.tsx
```

with the entire application inside it.

## Rule 5 — Keep the model independent

React must never become the source of truth for CAD geometry.

## Rule 6 — Test before claiming completion

Never say "done" without:

```text
typecheck
build
unit tests
relevant E2E tests
manual smoke test
```

## Rule 7 — Do not rewrite working code unnecessarily

Preserve existing functionality.

## Rule 8 — Explain assumptions

When uncertain, state the assumption before coding.

## Rule 9 — Prefer boring code

CAD software benefits from:

- explicit types
- deterministic algorithms
- small functions
- clear state transitions
- tests

Avoid clever abstractions.

## Rule 10 — Never fake a feature

If the solver cannot support a constraint reliably, do not make the UI pretend it works.

---

# 14. Agent task template

Use this prompt for every vibe-coding session:

```text
You are working on the 2D parametric mechanical sketcher.

First inspect the existing repository and identify:
- current architecture
- relevant files
- existing tests
- package manager
- build/test commands

Implement ONLY this chunk:

[INSERT ONE CHUNK]

Before coding:
1. Explain the implementation plan briefly.
2. Identify files that will change.
3. Identify mathematical/engineering risks.

Then implement it.

After implementation:
1. Run type checking.
2. Run unit tests.
3. Run build.
4. Run relevant E2E tests if available.
5. Fix failures.
6. Perform a manual smoke test if possible.
7. Report:
   - files changed
   - tests executed
   - test results
   - known limitations
   - next recommended chunk

Do not implement future chunks.
Do not add unnecessary dependencies.
Do not rewrite unrelated code.
Do not fake CAD/solver behavior.
Keep the parametric model independent of React.
```

---

# 15. Definition of done for every chunk

A chunk is complete only when all applicable conditions are true:

- [ ] Feature works in the UI
- [ ] Data model represents the feature correctly
- [ ] Geometry remains correct after editing
- [ ] Undo works
- [ ] Redo works
- [ ] Serialization works if applicable
- [ ] Unit tests exist
- [ ] Regression tests pass
- [ ] TypeScript passes
- [ ] Build passes
- [ ] No new console errors
- [ ] No unrelated functionality was broken
- [ ] Failure cases are handled
- [ ] Known limitations are documented

---

# 16. Global acceptance criteria

The first major release of the sketcher is successful when a user can perform this workflow:

```text
Open application
        ↓
Create new sketch
        ↓
See X/Y axes and origin
        ↓
Create lines
        ↓
Create circles
        ↓
Create arcs
        ↓
Create rectangle
        ↓
Snap geometry to useful references
        ↓
Add geometric constraints
        ↓
Add dimensional constraints
        ↓
Edit dimensions
        ↓
Solver updates geometry
        ↓
See remaining DOF
        ↓
Resolve under/over-constraints
        ↓
Create a closed profile
        ↓
Run Sketch Analysis
        ↓
Save sketch
        ↓
Reload sketch
        ↓
Geometry + constraints remain correct
```

The application must not claim to be ready for 3D conversion until:

- sketch topology is reliable
- closed-loop detection is reliable
- inner/outer loops are correctly classified
- construction geometry is separated
- self-intersections are detected
- constraints survive serialization
- the solver is deterministic enough for downstream use

---

# 17. Future module boundary

The architecture must make the following future modules possible without rewriting the sketcher:

```text
                 ┌──────────────────┐
                 │  2D Sketcher     │
                 └────────┬─────────┘
                          │
                    Sketch Model
                          │
             ┌────────────┴────────────┐
             │                         │
      Profile Analyzer          Constraint Data
             │
             ▼
      ┌───────────────┐
      │ Future 3D     │
      │ Feature Layer │
      └───────┬───────┘
              │
       ┌──────┼───────────┐
       ▼      ▼           ▼
      Pad   Pocket     Revolution
       │      │           │
       └──────┼───────────┘
              ▼
       Future CAD Kernel
              │
        STEP / STL / etc.
```

Do not couple the sketcher to a particular future 3D kernel.

Kernel adapter choice belongs to the later 3D phase.

---

# 18. What NOT to build yet

Do not build these in the first release:

- 3D viewport
- solids
- meshes
- STEP export
- STL export
- CAM
- assemblies
- drawings
- materials
- rendering
- simulation
- FEM
- cloud collaboration
- AI geometry generation
- natural-language CAD
- complex splines
- macros
- plugins

The purpose of the first release is to create an excellent, mathematically sound 2D parametric sketcher.

---

# 19. Final engineering philosophy

The application should eventually make this possible:

> "I can draw approximately, constrain precisely, change dimensions later, and trust that the geometry remains mathematically consistent."

That is the core product.

Do not optimize for the number of buttons.

Optimize for:

```text
Fast sketching
+
Predictable snapping
+
Reliable constraints
+
Transparent solver behavior
+
Excellent diagnostics
+
Clean parametric data
```

If those foundations are correct, 3D functionality can be added later as modules without rebuilding the sketcher.
