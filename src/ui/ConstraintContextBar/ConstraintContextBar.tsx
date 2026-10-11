import {
  evaluateConstraintApplicability,
  selectionConstraintAction,
  type ConstraintApplicability,
} from "../../sketch/constraints/ConstraintApplicability.ts";
import type { EntityId } from "../../sketch/model/Geometry.ts";
import type { Sketch } from "../../sketch/model/Sketch.ts";
import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";
import { constraintToolbarEntries } from "../ConstraintToolbar/ConstraintToolbar.tsx";
import { ToolIconButton } from "../icons/ToolIconButton.tsx";
import { renderToolGlyph } from "../icons/toolGlyphs.tsx";

const LABEL_BY_TOOL = new Map(
  constraintToolbarEntries().map((entry) => [entry.id, entry]),
);

type ConstraintContextBarProps = {
  readonly sketch: Sketch;
  readonly selectedIds: readonly EntityId[];
  readonly visible: boolean;
  readonly onAction: (toolId: ActiveTool) => void;
};

/**
 * Selection-driven constraint / dimension boxes (commercial-style context bar).
 * Inapplicable tools are greyed; hover shows why.
 */
export function ConstraintContextBar({
  sketch,
  selectedIds,
  visible,
  onAction,
}: ConstraintContextBarProps) {
  // Always mount a row so shell layout does not reflow when leaving Select.
  if (!visible) {
    return (
      <div
        className="constraint-context-bar constraint-context-bar--hidden"
        aria-hidden="true"
        data-testid="constraint-context-bar-spacer"
      />
    );
  }

  const rows = evaluateConstraintApplicability(sketch, selectedIds);
  const empty = selectedIds.length === 0;

  return (
    <div
      className="constraint-context-bar"
      role="toolbar"
      aria-label="Constraints for selection"
      data-testid="constraint-context-bar"
    >
      <span className="toolbar-label">Apply</span>
      {empty ? (
        <span className="constraint-context-hint">
          Select geometry to enable constraints
        </span>
      ) : (
        rows.map((row) => (
          <ContextBox key={row.toolId} row={row} onAction={onAction} />
        ))
      )}
    </div>
  );
}

function ContextBox({
  row,
  onAction,
}: {
  readonly row: ConstraintApplicability;
  readonly onAction: (toolId: ActiveTool) => void;
}) {
  const meta = LABEL_BY_TOOL.get(row.toolId);
  const label = meta?.label ?? row.toolId;
  const title =
    row.state === "disabled"
      ? `${label}: ${row.reason}`
      : meta !== undefined
        ? `${meta.title} — ${row.reason}`
        : row.reason;
  const disabled = row.state === "disabled";

  return (
    <ToolIconButton
      label={label}
      title={title}
      icon={renderToolGlyph(row.toolId)}
      disabled={disabled}
      className={
        disabled ? "constraint-context-box is-disabled" : "constraint-context-box"
      }
      onClick={() => {
        if (!disabled) {
          onAction(row.toolId);
        }
      }}
      testId={`context-${row.toolId}`}
    />
  );
}

export function resolveContextBarClick(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
  toolId: ActiveTool,
) {
  return selectionConstraintAction(sketch, selectedIds, toolId);
}
