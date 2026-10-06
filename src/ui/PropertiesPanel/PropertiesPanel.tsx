import { memo } from "react";
import type { Constraint } from "../../sketch/model/Constraint.ts";
import type { Geometry } from "../../sketch/model/Geometry.ts";
import type { SketchFrame } from "../../sketch/model/SketchFrame.ts";
import type { SelectionState } from "../../sketch/selection/SelectionManager.ts";
import {
  formatSelectionSummaryItem,
  summarizeSelection,
} from "../../sketch/selection/SelectionSummary.ts";

type PropertiesPanelProps = {
  readonly geometry: readonly Geometry[];
  readonly constraints: readonly Constraint[];
  readonly selection: SelectionState;
  readonly frame?: SketchFrame;
};

export const PropertiesPanel = memo(function PropertiesPanel({
  geometry,
  constraints,
  selection,
  frame,
}: PropertiesPanelProps) {
  const items = summarizeSelection(
    geometry,
    constraints,
    selection.selectedIds,
    frame,
  );

  return (
    <section className="panel" aria-label="Properties">
      <h2>Properties</h2>
      {items.length === 0 ? (
        <p>No geometry selected.</p>
      ) : (
        <ul className="property-list">
          {items.map((item) => (
            <li key={summaryKey(item)}>{formatSelectionSummaryItem(item)}</li>
          ))}
        </ul>
      )}
    </section>
  );
});

function summaryKey(
  item: ReturnType<typeof summarizeSelection>[number],
): string {
  if (item.kind === "rectangle") {
    return `rectangle:${item.constraintId}`;
  }
  if (item.kind === "datum") {
    return `datum:${item.entityId}`;
  }
  return `entity:${item.entity.id}`;
}
