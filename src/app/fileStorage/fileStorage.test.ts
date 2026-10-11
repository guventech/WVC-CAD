import { describe, expect, it } from "vitest";
import { createMemoryFileStorage } from "./memoryFileStorage.ts";
import {
  createLocalStorageRecentStore,
  loadRecentFiles,
  rememberRecentFile,
} from "./recentFiles.ts";
import type { SketchFileRef } from "./types.ts";

describe("memory FileStorage", () => {
  it("save twice overwrites the same file and open reloads it", async () => {
    const storage = createMemoryFileStorage();
    const first = await storage.saveAs('{"v":1}', "part.sketch.json");
    expect(first).not.toBeNull();
    expect(storage.files.get("part.sketch.json")).toBe('{"v":1}');

    const second = await storage.save('{"v":2}', first, "part.sketch.json");
    expect(second?.displayName).toBe("part.sketch.json");
    expect(storage.files.get("part.sketch.json")).toBe('{"v":2}');
    expect(storage.files.size).toBe(1);

    const opened = await storage.openRef(second!);
    expect(opened?.text).toBe('{"v":2}');
  });
});

describe("recent files", () => {
  it("keeps newest first and caps length", () => {
    const map = new Map<string, string>();
    const store = {
      read: () => map.get("k") ?? null,
      write: (value: string) => {
        map.set("k", value);
      },
    } satisfies ReturnType<typeof createLocalStorageRecentStore>;

    const a: SketchFileRef = {
      id: "a",
      displayName: "a.sketch.json",
      kind: "memory",
      resource: "a.sketch.json",
    };
    const b: SketchFileRef = {
      id: "b",
      displayName: "b.sketch.json",
      kind: "memory",
      resource: "b.sketch.json",
    };

    rememberRecentFile(a, store, "2026-01-01T00:00:00.000Z");
    rememberRecentFile(b, store, "2026-01-02T00:00:00.000Z");
    rememberRecentFile(a, store, "2026-01-03T00:00:00.000Z");

    const recent = loadRecentFiles(store);
    expect(recent.map((item) => item.id)).toEqual(["a", "b"]);
    expect(recent[0]?.openedAt).toBe("2026-01-03T00:00:00.000Z");
  });
});
