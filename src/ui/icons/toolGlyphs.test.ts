import { describe, expect, it } from "vitest";
import {
  allGlyphIds,
  CHROME_ACTION_IDS,
  CONSTRAINT_TOOL_IDS,
  DIMENSION_TOOL_IDS,
  GEOMETRY_TOOL_IDS,
  renderToolGlyph,
} from "./toolGlyphs.tsx";

describe("tool glyphs", () => {
  it("covers every geometry, constraint, dimension, and chrome action id", () => {
    const ids = allGlyphIds();
    expect(ids).toEqual([
      ...GEOMETRY_TOOL_IDS,
      ...CONSTRAINT_TOOL_IDS,
      ...DIMENSION_TOOL_IDS,
      ...CHROME_ACTION_IDS,
    ]);
    for (const id of ids) {
      expect(() => renderToolGlyph(id)).not.toThrow();
    }
  });
});
