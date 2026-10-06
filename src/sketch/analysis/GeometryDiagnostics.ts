import {
  arcSweepRadians,
  distance,
  pointsApproximatelyEqual,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type {
  ArcGeometry,
  CircleGeometry,
  EntityId,
  Geometry,
} from "../model/Geometry.ts";
import type { DiagnosticFinding } from "./DiagnosticTypes.ts";

export function collectGeometryIssues(geometry: readonly Geometry[]): {
  readonly findings: DiagnosticFinding[];
} {
  const findings: DiagnosticFinding[] = [];
  let findingIndex = 0;
  const nextId = (code: string) => `geo-${code}-${findingIndex++}`;

  for (const entity of geometry) {
    if (entity.type === "line") {
      if (distance(entity.start, entity.end) <= TOLERANCE.coincidence) {
        findings.push({
          id: nextId("zero-length"),
          severity: "error",
          category: "geometry",
          code: "zero-length-line",
          message: `Zero-length line (${entity.id})`,
          entityIds: [entity.id],
        });
      }
    } else if (entity.type === "circle") {
      if (!(entity.radius > TOLERANCE.coincidence)) {
        findings.push({
          id: nextId("zero-radius"),
          severity: "error",
          category: "geometry",
          code: "zero-radius-circle",
          message: `Zero-radius circle (${entity.id})`,
          entityIds: [entity.id],
        });
      }
    } else if (entity.type === "arc") {
      const issue = invalidArcReason(entity);
      if (issue !== null) {
        findings.push({
          id: nextId("invalid-arc"),
          severity: "error",
          category: "geometry",
          code: "invalid-arc",
          message: `${issue} (${entity.id})`,
          entityIds: [entity.id],
        });
      }
    }
  }

  findings.push(...findDuplicateGeometry(geometry, nextId));
  return { findings };
}

function invalidArcReason(arc: ArcGeometry): string | null {
  if (!(arc.radius > TOLERANCE.coincidence)) {
    return "Zero-radius arc";
  }
  if (!Number.isFinite(arc.startAngle) || !Number.isFinite(arc.endAngle)) {
    return "Invalid arc angles";
  }
  const sweep = arcSweepRadians(arc.startAngle, arc.endAngle);
  if (sweep <= TOLERANCE.angular) {
    return "Degenerate arc (zero sweep)";
  }
  return null;
}

function findDuplicateGeometry(
  geometry: readonly Geometry[],
  nextId: (code: string) => string,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  for (let i = 0; i < geometry.length; i += 1) {
    for (let j = i + 1; j < geometry.length; j += 1) {
      const a = geometry[i]!;
      const b = geometry[j]!;
      if (!geometriesApproximatelyEqual(a, b)) {
        continue;
      }
      findings.push({
        id: nextId("duplicate"),
        severity: "warn",
        category: "geometry",
        code: "duplicate-geometry",
        message: `Duplicate ${a.type} geometry (${a.id}, ${b.id})`,
        entityIds: [a.id, b.id],
      });
    }
  }
  return findings;
}

function geometriesApproximatelyEqual(a: Geometry, b: Geometry): boolean {
  if (a.type !== b.type || a.construction !== b.construction) {
    return false;
  }
  switch (a.type) {
    case "point":
      return (
        b.type === "point" &&
        pointsApproximatelyEqual(a.position, b.position, TOLERANCE.coincidence)
      );
    case "line":
      return (
        b.type === "line" &&
        ((pointsApproximatelyEqual(a.start, b.start, TOLERANCE.coincidence) &&
          pointsApproximatelyEqual(a.end, b.end, TOLERANCE.coincidence)) ||
          (pointsApproximatelyEqual(a.start, b.end, TOLERANCE.coincidence) &&
            pointsApproximatelyEqual(a.end, b.start, TOLERANCE.coincidence)))
      );
    case "circle":
      return b.type === "circle" && circlesEqual(a, b);
    case "arc":
      return b.type === "arc" && arcsEqual(a, b);
  }
}

function circlesEqual(a: CircleGeometry, b: CircleGeometry): boolean {
  return (
    pointsApproximatelyEqual(a.center, b.center, TOLERANCE.coincidence) &&
    Math.abs(a.radius - b.radius) <= TOLERANCE.coincidence
  );
}

function arcsEqual(a: ArcGeometry, b: ArcGeometry): boolean {
  return (
    pointsApproximatelyEqual(a.center, b.center, TOLERANCE.coincidence) &&
    Math.abs(a.radius - b.radius) <= TOLERANCE.coincidence &&
    Math.abs(a.startAngle - b.startAngle) <= TOLERANCE.angular &&
    Math.abs(a.endAngle - b.endAngle) <= TOLERANCE.angular
  );
}

export function invalidGeometryEntityIds(
  findings: readonly DiagnosticFinding[],
): Set<EntityId> {
  return new Set(findings.flatMap((f) => f.entityIds ?? []));
}
