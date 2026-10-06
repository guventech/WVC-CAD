import { useState } from "react";
import type { DimensionEdit } from "../../sketch/commands/EditDimensionCommand.ts";
import {
  formatDimensionInputValue,
  parseDimensionInput,
} from "../../sketch/constraints/DimensionInput.ts";
import { measureDimension } from "../../sketch/constraints/Dimensions.ts";
import type { Constraint } from "../../sketch/model/Constraint.ts";
import { isDrivingConstraint } from "../../sketch/model/Constraint.ts";
import type { Sketch } from "../../sketch/model/Sketch.ts";

type DimensionEditorProps = {
  readonly sketch: Sketch;
  readonly constraint: Constraint;
  readonly label: string;
  readonly onEdit: (constraintId: string, edit: DimensionEdit) => void;
  readonly onParseError?: (reason: string) => void;
};

/**
 * Value + driving toggle for one dimension. Angle is edited in degrees; the
 * model stores radians. Validation lives in parse + edit command.
 */
export function DimensionEditor({
  sketch,
  constraint,
  label,
  onEdit,
  onParseError,
}: DimensionEditorProps) {
  const driving = isDrivingConstraint(constraint);
  const measured = measureDimension(sketch, constraint.type, constraint.references);
  const shown = driving ? constraint.value : measured;
  const isAngle = constraint.type === "angle";
  const kind = isAngle ? "angle" : "length";
  const display =
    shown === undefined || shown === null
      ? ""
      : formatDimensionInputValue(shown, kind);
  const unit = isAngle ? "°" : "mm";

  return (
    <span className="dimension-row">
      <span>{label}</span>
      <ValueInput
        key={`${constraint.id}:${display}:${driving}`}
        initial={display}
        disabled={!driving}
        ariaLabel={`${label} ${constraint.id} value`}
        onCommit={(text) => {
          const parsed = parseDimensionInput(text, kind);
          if (!parsed.ok) {
            onParseError?.(parsed.reason);
            return;
          }
          onEdit(constraint.id, { value: parsed.value });
        }}
      />
      <span>{unit}</span>
      <label className="dimension-driving">
        <input
          type="checkbox"
          checked={driving}
          aria-label={`${constraint.id} driving`}
          onChange={(event) => onEdit(constraint.id, { driving: event.target.checked })}
        />
        driving
      </label>
    </span>
  );
}

function ValueInput({
  initial,
  disabled,
  ariaLabel,
  onCommit,
}: {
  readonly initial: string;
  readonly disabled: boolean;
  readonly ariaLabel: string;
  readonly onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const commit = () => {
    if (text.trim() === initial.trim()) {
      return;
    }
    onCommit(text);
  };

  return (
    <input
      className="dimension-input"
      type="text"
      inputMode="decimal"
      value={text}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        } else if (event.key === "Escape") {
          setText(initial);
        }
      }}
    />
  );
}
