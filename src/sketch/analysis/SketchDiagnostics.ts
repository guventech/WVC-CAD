import {
  collectGeometryIssues,
  invalidGeometryEntityIds,
} from "./GeometryDiagnostics.ts";
import { analyzeProfiles } from "./ProfileAnalyzer.ts";
import { analyzeSolidLineTopology } from "./TopologyDiagnostics.ts";
import type {
  DiagnosticFinding,
  DiagnosticSeverity,
} from "./DiagnosticTypes.ts";
import {
  analyzeDegreesOfFreedom,
  type DofAnalysis,
} from "../constraints/DegreesOfFreedom.ts";
import { analyzeUnderConstrainedVisualization } from "../constraints/UnderConstrainedViz.ts";
import type { Sketch } from "../model/Sketch.ts";
import { solve } from "../solver/Solver.ts";
import type { SolverResult } from "../solver/SolverResult.ts";

export type {
  DiagnosticCategory,
  DiagnosticFinding,
  DiagnosticSeverity,
} from "./DiagnosticTypes.ts";

export interface SketchDiagnosticsSummary {
  readonly geometryTotal: number;
  readonly geometryValid: number;
  readonly constructionCount: number;
  readonly constraintCount: number;
  readonly degreesOfFreedom: number;
  readonly openEndpointCount: number;
  readonly closedProfileDetected: boolean;
  readonly selfIntersectionCount: number;
  readonly outerLoopCount: number;
  readonly holeLoopCount: number;
  readonly openWireCount: number;
}

export interface SketchDiagnosticsReport {
  readonly findings: readonly DiagnosticFinding[];
  readonly summary: SketchDiagnosticsSummary;
  readonly solverResult: SolverResult;
  readonly dof: DofAnalysis;
}

/**
 * Analyze a sketch for geometry, constraint, and provisional profile issues.
 * Pure domain function — no React. Profile loops via `analyzeProfiles` (Chunk 23).
 */
export function analyzeSketchDiagnostics(
  sketch: Sketch,
): SketchDiagnosticsReport {
  const findings: DiagnosticFinding[] = [];
  const solverResult = solve(sketch);
  const dof = analyzeDegreesOfFreedom(sketch);
  const under = analyzeUnderConstrainedVisualization(sketch);
  const profiles = analyzeProfiles(sketch);

  const geometryIssues = collectGeometryIssues(sketch.geometry);
  findings.push(...geometryIssues.findings);

  const topology = analyzeSolidLineTopology(sketch.geometry);
  findings.push(...topology.findings);

  findings.push(...collectConstraintFindings(sketch, solverResult, dof, under));
  findings.push(...collectProfileFindings(profiles));

  const constructionCount = sketch.geometry.filter((e) => e.construction).length;
  const invalidIds = invalidGeometryEntityIds(geometryIssues.findings);

  return {
    findings,
    summary: {
      geometryTotal: sketch.geometry.length,
      geometryValid: sketch.geometry.length - invalidIds.size,
      constructionCount,
      constraintCount: sketch.constraints.length,
      degreesOfFreedom: dof.degreesOfFreedom,
      openEndpointCount: topology.openEndpointCount,
      closedProfileDetected: profiles.outerLoopCount > 0,
      selfIntersectionCount: profiles.selfIntersectionCount,
      outerLoopCount: profiles.outerLoopCount,
      holeLoopCount: profiles.holeLoopCount,
      openWireCount: profiles.openEntityIds.length,
    },
    solverResult,
    dof,
  };
}

/** Panel-oriented lines matching the Chunk 22 example layout. */
export function formatDiagnosticsLines(
  report: SketchDiagnosticsReport,
): readonly string[] {
  const { summary, findings } = report;
  const lines: string[] = ["Sketch Analysis", "", "Geometry"];

  if (summary.geometryTotal === 0) {
    lines.push("ℹ No geometry");
  } else {
    lines.push(
      `${okOrWarn(summary.geometryValid === summary.geometryTotal)} ${summary.geometryValid} valid entit${summary.geometryValid === 1 ? "y" : "ies"}`,
    );
  }
  if (summary.constructionCount > 0) {
    lines.push(
      `✓ ${summary.constructionCount} construction entit${summary.constructionCount === 1 ? "y" : "ies"}`,
    );
  }
  for (const finding of findings.filter((f) => f.category === "geometry")) {
    lines.push(`${severityGlyph(finding.severity)} ${finding.message}`);
  }

  lines.push("", "Constraints");
  if (summary.constraintCount === 0) {
    lines.push("ℹ No constraints");
  } else {
    const constraintProblems = findings.filter(
      (f) => f.category === "constraints" && f.severity !== "ok",
    );
    if (constraintProblems.length === 0) {
      lines.push(`✓ ${summary.constraintCount} valid constraints`);
    } else {
      lines.push(
        `${severityGlyph("warn")} ${summary.constraintCount} constraint${summary.constraintCount === 1 ? "" : "s"}`,
      );
    }
  }
  for (const finding of findings.filter((f) => f.category === "constraints")) {
    lines.push(`${severityGlyph(finding.severity)} ${finding.message}`);
  }

  lines.push("", "Profiles");
  for (const finding of findings.filter((f) => f.category === "profiles")) {
    lines.push(`${severityGlyph(finding.severity)} ${finding.message}`);
  }
  if (!findings.some((f) => f.category === "profiles")) {
    lines.push("ℹ No solid wire geometry");
  }

  return lines;
}

function okOrWarn(ok: boolean): string {
  return ok ? "✓" : "⚠";
}

function severityGlyph(severity: DiagnosticSeverity): string {
  switch (severity) {
    case "ok":
      return "✓";
    case "info":
      return "ℹ";
    case "warn":
      return "⚠";
    case "error":
      return "✗";
  }
}

function collectConstraintFindings(
  sketch: Sketch,
  solverResult: SolverResult,
  dof: DofAnalysis,
  under: ReturnType<typeof analyzeUnderConstrainedVisualization>,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  if (sketch.constraints.length === 0 && sketch.geometry.length > 0) {
    findings.push({
      id: "con-none",
      severity: "info",
      category: "constraints",
      code: "no-constraints",
      message: "No constraints applied",
    });
  }

  if (
    solverResult.status === "over-constrained" ||
    solverResult.status === "inconsistent"
  ) {
    findings.push({
      id: "con-conflict",
      severity: "error",
      category: "constraints",
      code: "conflicting-constraints",
      message:
        solverResult.status === "over-constrained"
          ? "Conflicting / over-constrained system"
          : "Inconsistent constraint system",
      constraintIds: solverResult.conflictingConstraints,
    });
  }

  if (dof.redundantEquations > 0 && solverResult.status === "solved") {
    findings.push({
      id: "con-redundant",
      severity: "warn",
      category: "constraints",
      code: "redundant-constraints",
      message: `${dof.redundantEquations} redundant constraint equation${dof.redundantEquations === 1 ? "" : "s"}`,
    });
  }

  if (dof.degreesOfFreedom > 0) {
    findings.push({
      id: "con-dof",
      severity: "warn",
      category: "constraints",
      code: "remaining-dof",
      message: `${dof.degreesOfFreedom} remaining DOF`,
    });
  }

  const unconstrainedIds = [
    ...new Set(under.freeHandles.map((handle) => handle.entityId)),
  ];
  if (unconstrainedIds.length > 0) {
    findings.push({
      id: "con-unconstrained-geom",
      severity: "warn",
      category: "constraints",
      code: "unconstrained-geometry",
      message: `${unconstrainedIds.length} unconstrained entit${unconstrainedIds.length === 1 ? "y" : "ies"}`,
      entityIds: unconstrainedIds,
    });
  }

  return findings;
}

function collectProfileFindings(
  profiles: ReturnType<typeof analyzeProfiles>,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  if (profiles.selfIntersectionCount > 0) {
    findings.push({
      id: "prof-self-x",
      severity: "error",
      category: "profiles",
      code: "profile-self-intersection",
      message: `${profiles.selfIntersectionCount} profile self-intersection${profiles.selfIntersectionCount === 1 ? "" : "s"}`,
    });
  }

  if (profiles.openEntityIds.length > 0) {
    findings.push({
      id: "prof-open-wire",
      severity: "warn",
      category: "profiles",
      code: "open-wire",
      message: `${profiles.openEntityIds.length} open wire entit${profiles.openEntityIds.length === 1 ? "y" : "ies"}`,
      entityIds: profiles.openEntityIds,
    });
  }

  if (profiles.outerLoopCount > 0) {
    const holeText =
      profiles.holeLoopCount === 0
        ? "0 holes"
        : `${profiles.holeLoopCount} hole${profiles.holeLoopCount === 1 ? "" : "s"}`;
    findings.push({
      id: "prof-closed",
      severity: "ok",
      category: "profiles",
      code: "closed-profile",
      message: `${profiles.outerLoopCount} outer profile${profiles.outerLoopCount === 1 ? "" : "s"}, ${holeText}`,
    });
  } else if (profiles.openEntityIds.length > 0 || profiles.loops.length === 0) {
    findings.push({
      id: "prof-open",
      severity: "error",
      category: "profiles",
      code: "open-profile",
      message: "No closed profile detected",
    });
  }

  return findings;
}
