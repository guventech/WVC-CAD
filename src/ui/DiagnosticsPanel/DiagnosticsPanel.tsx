import { memo, useMemo } from "react";
import {
  analyzeSketchDiagnostics,
  type DiagnosticFinding,
  type DiagnosticSeverity,
} from "../../sketch/analysis/SketchDiagnostics.ts";
import type { Sketch } from "../../sketch/model/Sketch.ts";

type DiagnosticsPanelProps = {
  readonly sketch: Sketch;
};

export const DiagnosticsPanel = memo(function DiagnosticsPanel({
  sketch,
}: DiagnosticsPanelProps) {
  const report = useMemo(() => analyzeSketchDiagnostics(sketch), [sketch]);
  const { summary, findings } = report;

  const geometryFindings = findings.filter((f) => f.category === "geometry");
  const constraintFindings = findings.filter((f) => f.category === "constraints");
  const profileFindings = findings.filter((f) => f.category === "profiles");

  return (
    <section className="panel" aria-label="Sketch analysis" data-testid="diagnostics-panel">
      <h2>Sketch Analysis</h2>

      <h3 className="panel-subheading">Geometry</h3>
      <ul className="diagnostic-list">
        {summary.geometryTotal === 0 ? (
          <li className="diagnostic-info">No geometry</li>
        ) : (
          <li className={summary.geometryValid === summary.geometryTotal ? "diagnostic-ok" : "diagnostic-warn"}>
            {summary.geometryValid} valid entit
            {summary.geometryValid === 1 ? "y" : "ies"}
          </li>
        )}
        {summary.constructionCount > 0 && (
          <li className="diagnostic-ok">
            {summary.constructionCount} construction entit
            {summary.constructionCount === 1 ? "y" : "ies"}
          </li>
        )}
        {geometryFindings.map((finding) => (
          <FindingItem key={finding.id} finding={finding} />
        ))}
      </ul>

      <h3 className="panel-subheading">Constraints</h3>
      <ul className="diagnostic-list">
        {summary.constraintCount === 0 ? (
          <li className="diagnostic-info">No constraints</li>
        ) : (
          <li
            className={
              constraintFindings.some((f) => f.severity === "error")
                ? "diagnostic-error"
                : constraintFindings.some((f) => f.severity === "warn")
                  ? "diagnostic-warn"
                  : "diagnostic-ok"
            }
          >
            {summary.constraintCount} constraint
            {summary.constraintCount === 1 ? "" : "s"}
          </li>
        )}
        {constraintFindings.map((finding) => (
          <FindingItem key={finding.id} finding={finding} />
        ))}
      </ul>

      <h3 className="panel-subheading">Profiles</h3>
      <ul className="diagnostic-list" data-testid="diagnostics-profiles">
        {summary.outerLoopCount + summary.openWireCount === 0 &&
        summary.holeLoopCount === 0 ? (
          <li className="diagnostic-info">No solid wire geometry</li>
        ) : (
          <>
            {summary.outerLoopCount > 0 && (
              <li className="diagnostic-ok" data-testid="profile-outer-count">
                {summary.outerLoopCount} outer loop
                {summary.outerLoopCount === 1 ? "" : "s"}
                {summary.holeLoopCount > 0
                  ? `, ${summary.holeLoopCount} hole${summary.holeLoopCount === 1 ? "" : "s"}`
                  : ""}
              </li>
            )}
            {profileFindings.map((finding) => (
              <FindingItem key={finding.id} finding={finding} />
            ))}
          </>
        )}
      </ul>
    </section>
  );
});

function FindingItem({ finding }: { readonly finding: DiagnosticFinding }) {
  return (
    <li
      className={severityClass(finding.severity)}
      data-code={finding.code}
      title={finding.entityIds?.join(", ") ?? finding.constraintIds?.join(", ")}
    >
      {finding.message}
    </li>
  );
}

function severityClass(severity: DiagnosticSeverity): string {
  switch (severity) {
    case "ok":
      return "diagnostic-ok";
    case "info":
      return "diagnostic-info";
    case "warn":
      return "diagnostic-warn";
    case "error":
      return "diagnostic-error";
  }
}
