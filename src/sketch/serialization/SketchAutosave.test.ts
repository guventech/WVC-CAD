import { describe, expect, it } from "vitest";
import { createAddLineCommand } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  buildAutosaveEnvelope,
  clearAutosaveStore,
  createMemoryAutosaveStore,
  emptySketchCleanFingerprint,
  isSketchDirty,
  parseAutosaveEnvelope,
  readAutosaveStore,
  restoreSketchFromEnvelope,
  shouldOfferRecovery,
  sketchContentFingerprint,
  writeAutosaveStore,
} from "./SketchAutosave.ts";

describe("SketchAutosave", () => {
  it("detects dirty state from content fingerprint", () => {
    resetEntityIdCounter();
    const clean = emptySketchCleanFingerprint();
    const empty = createEmptySketch();
    expect(isSketchDirty(empty, clean)).toBe(false);

    const edited = createAddLineCommand({ x: 0, y: 0 }, { x: 10, y: 0 })!.apply(
      empty,
    );
    expect(isSketchDirty(edited, clean)).toBe(true);
    expect(isSketchDirty(edited, sketchContentFingerprint(edited))).toBe(false);
  });

  it("fingerprint ignores savedAt metadata volatility", () => {
    resetEntityIdCounter();
    const sketch = createEmptySketch();
    const a = buildAutosaveEnvelope(sketch, {
      documentFileName: null,
      lastCleanFingerprint: emptySketchCleanFingerprint(),
      savedAt: "2026-01-01T00:00:00.000Z",
    });
    const b = buildAutosaveEnvelope(sketch, {
      documentFileName: null,
      lastCleanFingerprint: emptySketchCleanFingerprint(),
      savedAt: "2026-12-31T23:59:59.000Z",
    });
    expect(a.contentFingerprint).toBe(b.contentFingerprint);
  });

  it("writes recovery to a separate store slot without needing a user file", () => {
    resetEntityIdCounter();
    const store = createMemoryAutosaveStore();
    const clean = emptySketchCleanFingerprint();
    let sketch = createAddLineCommand({ x: 1, y: 2 }, { x: 3, y: 4 })!.apply(
      createEmptySketch(),
    );

    writeAutosaveStore(store, sketch, {
      documentFileName: "part.sketch.json",
      lastCleanFingerprint: clean,
    });
    expect(store.snapshots).toHaveLength(1);

    const read = readAutosaveStore(store);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      return;
    }
    expect(shouldOfferRecovery(read.envelope)).toBe(true);
    expect(read.envelope.documentFileName).toBe("part.sketch.json");

    const restored = restoreSketchFromEnvelope(read.envelope);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(restored.sketch.geometry).toEqual(sketch.geometry);
    expect(isSketchDirty(restored.sketch, read.envelope.lastCleanFingerprint)).toBe(
      true,
    );

    clearAutosaveStore(store);
    expect(readAutosaveStore(store).ok).toBe(false);
  });

  it("does not offer recovery for an empty clean autosave", () => {
    resetEntityIdCounter();
    const envelope = buildAutosaveEnvelope(createEmptySketch(), {
      documentFileName: null,
      lastCleanFingerprint: emptySketchCleanFingerprint(),
    });
    expect(shouldOfferRecovery(envelope)).toBe(false);
  });

  it("rejects a corrupt autosave envelope", () => {
    const parsed = parseAutosaveEnvelope({ envelopeVersion: 99 });
    expect(parsed.ok).toBe(false);
  });
});
