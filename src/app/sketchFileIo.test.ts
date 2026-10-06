import { describe, expect, it } from "vitest";
import { sketchDownloadFileName } from "./sketchFileIo.ts";

describe("sketchFileIo", () => {
  it("builds a safe .sketch.json filename", () => {
    expect(sketchDownloadFileName("My Part")).toBe("my-part.sketch.json");
    expect(sketchDownloadFileName("a/b:c")).toBe("a-b-c.sketch.json");
    expect(sketchDownloadFileName("already.sketch.json")).toBe(
      "already.sketch.json",
    );
  });
});
