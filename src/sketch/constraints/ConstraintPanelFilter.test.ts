import { describe, expect, it } from "vitest";
import type { Constraint } from "../model/Constraint.ts";
import {
  constraintsRelatedToSelection,
  filterConstraintsForPanel,
  isFeatureConstraintRow,
} from "./ConstraintPanelFilter.ts";

function c(
  id: string,
  type: Constraint["type"],
  entityIds: string[],
): Constraint {
  return {
    id,
    type,
    references: entityIds.map((entityId) => ({
      entityId,
      role: "entity" as const,
    })),
  };
}

describe("ConstraintPanelFilter", () => {
  const constraints = [
    c("h1", "horizontal", ["line-1"]),
    c("v1", "vertical", ["line-2"]),
    c("r1", "rectangle", ["line-1", "line-2", "line-3", "line-4"]),
  ];

  it("returns related constraints for selection", () => {
    expect(
      constraintsRelatedToSelection(constraints, ["line-1"]).map((item) => item.id),
    ).toEqual(["h1", "r1"]);
  });

  it("falls back to all when filter is all or selection empty", () => {
    expect(filterConstraintsForPanel(constraints, ["line-1"], "all")).toHaveLength(
      3,
    );
    expect(filterConstraintsForPanel(constraints, [], "related")).toHaveLength(3);
  });

  it("marks feature constraints", () => {
    expect(isFeatureConstraintRow(constraints[2]!)).toBe(true);
    expect(isFeatureConstraintRow(constraints[0]!)).toBe(false);
  });
});
