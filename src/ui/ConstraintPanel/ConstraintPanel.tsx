import { memo } from "react";
import type { DimensionEdit } from "../../sketch/commands/EditDimensionCommand.ts";
import {
  constraintStatusTone,
  formatConstraintStatus,
} from "../../sketch/constraints/DegreesOfFreedom.ts";
import { getConstraintTypeInfo } from "../../sketch/constraints/ConstraintTypes.ts";
import { isSupportedDimensionType } from "../../sketch/constraints/Dimensions.ts";
import type { ConstraintConflict } from "../../sketch/constraints/OverConstraint.ts";
import type { UnderConstrainedVisualization } from "../../sketch/constraints/UnderConstrainedViz.ts";
import type { Constraint } from "../../sketch/model/Constraint.ts";
import { isDrivingConstraint } from "../../sketch/model/Constraint.ts";
import type { Sketch } from "../../sketch/model/Sketch.ts";
import type { SolverResult } from "../../sketch/solver/SolverResult.ts";
import { DimensionEditor } from "./DimensionEditor.tsx";

type ConstraintPanelProps = {
  readonly sketch: Sketch;
  readonly solverResult: SolverResult;
  readonly underConstrained?: UnderConstrainedVisualization | null;
  /** Last rejected constraint operation (null when the last one succeeded). */
  readonly message: string | null;
  readonly conflict?: ConstraintConflict | null;
  readonly onDismissConflict?: () => void;
  readonly onEditDimension: (constraintId: string, edit: DimensionEdit) => void;
  readonly onDeleteConstraint: (constraintId: string) => void;
  readonly onParseError?: (reason: string) => void;
};

export const ConstraintPanel = memo(function ConstraintPanel({
  sketch,
  solverResult,
  underConstrained = null,
  message,
  conflict = null,
  onDismissConflict,
  onEditDimension,
  onDeleteConstraint,
  onParseError,
}: ConstraintPanelProps) {
  const { constraints } = sketch;
  const statusLabel = formatConstraintStatus(solverResult, {
    geometryCount: sketch.geometry.length,
  });
  const tone = constraintStatusTone(solverResult.status);
  const dofHint =
    solverResult.status === "under-constrained" && underConstrained !== null
      ? underConstrained.summary
      : null;
  const conflictIds = new Set(conflict?.conflictingConstraintIds ?? []);

  return (
    <section className="panel" aria-label="Constraint status">
      <h2>Constraints</h2>
      <p className={`panel-status status-dof-${tone}`} data-testid="panel-constraint-status">
        {statusLabel}
      </p>
      {dofHint !== null && (
        <p className="panel-note" data-testid="panel-dof-hint">
          {dofHint}
        </p>
      )}
      {solverResult.warnings[0] !== undefined && (
        <p className="panel-note">{solverResult.warnings[0]}</p>
      )}
      {message !== null && (
        <div className="panel-error" role="alert" data-testid="constraint-conflict">
          <p>{message}</p>
          {conflict !== null && conflict.conflictingConstraintIds.length > 0 && (
            <p className="panel-note">
              Involved:{" "}
              {conflict.conflictingConstraintIds
                .map((id) => {
                  const item = constraints.find((c) => c.id === id);
                  return item === undefined
                    ? id
                    : `${labelOf(item)} (${id})`;
                })
                .join(", ")}
            </p>
          )}
          {onDismissConflict !== undefined && (
            <button type="button" className="panel-dismiss" onClick={onDismissConflict}>
              Dismiss
            </button>
          )}
        </div>
      )}
      {constraints.length === 0 ? (
        <p>No constraints in sketch.</p>
      ) : (
        <ul className="property-list">
          {constraints.map((constraint) => (
            <li
              key={constraint.id}
              className={
                conflictIds.has(constraint.id)
                  ? "constraint-row constraint-conflict"
                  : "constraint-row"
              }
            >
              <div className="constraint-row-main">
                {isSupportedDimensionType(constraint.type) ? (
                  <DimensionEditor
                    sketch={sketch}
                    constraint={constraint}
                    label={labelOf(constraint)}
                    onEdit={onEditDimension}
                    onParseError={onParseError}
                  />
                ) : (
                  formatConstraint(constraint)
                )}
              </div>
              <button
                type="button"
                className="constraint-delete"
                title={`Delete ${labelOf(constraint)}`}
                aria-label={`Delete ${labelOf(constraint)} ${constraint.id}`}
                data-testid={`delete-constraint-${constraint.id}`}
                onClick={() => onDeleteConstraint(constraint.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

function labelOf(constraint: Constraint): string {
  return getConstraintTypeInfo(constraint.type)?.label ?? constraint.type;
}

function formatConstraint(constraint: Constraint): string {
  const label = labelOf(constraint);
  const refs = constraint.references.length;
  if (constraint.value !== undefined) {
    const mode = isDrivingConstraint(constraint) ? "driving" : "reference";
    return `${label} ${constraint.id} · ${formatValue(constraint)} · ${mode} · ${refs} ref`;
  }
  return `${label} ${constraint.id} · ${refs} ref`;
}

function formatValue(constraint: Constraint): string {
  const value = constraint.value;
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  if (constraint.type === "angle") {
    return `${((value * 180) / Math.PI).toFixed(1)}°`;
  }
  return `${value.toFixed(2)} mm`;
}
