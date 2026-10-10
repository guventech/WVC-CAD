import { describe, expect, it } from "vitest";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createCommandHistory, executeCommand } from "../commands/Command.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { resolveOffsetSource } from "./OffsetSource.ts";

describe("OffsetSource", () => {
  it("resolves a rectangle edge to a closed polyline loop", () => {
    const command = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 20 },
    )!;
    const { sketch } = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      command,
    );
    const line = sketch.geometry.find((g) => g.type === "line")!;
    const source = resolveOffsetSource(sketch, line.id);
    expect(source?.kind).toBe("polyline");
    if (source?.kind === "polyline") {
      expect(source.closed).toBe(true);
      expect(source.vertices).toHaveLength(4);
    }
  });
});
