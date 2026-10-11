import type { Sketch } from "../model/Sketch.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  parseSketchDocument,
  sketchToDocument,
  type SketchParseOutcome,
} from "./SketchSerializer.ts";
import {
  SKETCH_SCHEMA_VERSION,
  type SketchDocument,
} from "./SketchSchema.ts";

/** Envelope version for the local autosave slot (independent of sketch schema). */
export const AUTOSAVE_ENVELOPE_VERSION = 1 as const;

/** Default localStorage key — never the user's primary download path. */
export const DEFAULT_AUTOSAVE_STORAGE_KEY = "wvc-cad.autosave.v1";

export const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 750;

export interface AutosaveEnvelope {
  readonly envelopeVersion: typeof AUTOSAVE_ENVELOPE_VERSION;
  readonly sketchSchemaVersion: number;
  readonly savedAt: string;
  readonly documentFileName: string | null;
  /** Fingerprint of the last explicit Save/Open baseline when this slot was written. */
  readonly lastCleanFingerprint: string;
  readonly contentFingerprint: string;
  readonly document: SketchDocument;
}

export interface AutosaveStore {
  read(): string | null;
  write(text: string): void;
  clear(): void;
}

export type AutosaveReadOutcome =
  | { readonly ok: true; readonly envelope: AutosaveEnvelope }
  | { readonly ok: false; readonly reason: string };

/**
 * Stable content fingerprint for dirty detection.
 * Excludes volatile metadata (e.g. savedAt) so autosave timestamps do not dirty the doc.
 */
export function sketchContentFingerprint(sketch: Sketch): string {
  const document = sketchToDocument(sketch, { savedAt: "fingerprint" });
  return JSON.stringify({
    schemaVersion: document.schemaVersion,
    units: document.units,
    id: document.id,
    name: document.name,
    geometry: document.geometry,
    constraints: document.constraints,
    settings: document.settings,
    frame: document.frame,
  });
}

export function isSketchDirty(
  sketch: Sketch,
  lastCleanFingerprint: string,
): boolean {
  return sketchContentFingerprint(sketch) !== lastCleanFingerprint;
}

export function emptySketchCleanFingerprint(): string {
  return sketchContentFingerprint(createEmptySketch());
}

export function buildAutosaveEnvelope(
  sketch: Sketch,
  options: {
    readonly documentFileName: string | null;
    readonly lastCleanFingerprint: string;
    readonly savedAt?: string;
  },
): AutosaveEnvelope {
  const document = sketchToDocument(sketch, { savedAt: options.savedAt });
  return {
    envelopeVersion: AUTOSAVE_ENVELOPE_VERSION,
    sketchSchemaVersion: SKETCH_SCHEMA_VERSION,
    savedAt: options.savedAt ?? document.metadata?.savedAt ?? new Date().toISOString(),
    documentFileName: options.documentFileName,
    lastCleanFingerprint: options.lastCleanFingerprint,
    contentFingerprint: sketchContentFingerprint(sketch),
    document,
  };
}

export function serializeAutosaveEnvelope(envelope: AutosaveEnvelope): string {
  return JSON.stringify(envelope);
}

export function parseAutosaveEnvelope(raw: unknown): AutosaveReadOutcome {
  if (!isRecord(raw)) {
    return { ok: false, reason: "Autosave envelope must be a JSON object." };
  }
  if (raw.envelopeVersion !== AUTOSAVE_ENVELOPE_VERSION) {
    return {
      ok: false,
      reason: `Unsupported autosave envelope version ${String(raw.envelopeVersion)}.`,
    };
  }
  if (raw.sketchSchemaVersion !== SKETCH_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `Unsupported sketch schema in autosave (${String(raw.sketchSchemaVersion)}).`,
    };
  }
  if (typeof raw.savedAt !== "string") {
    return { ok: false, reason: "Autosave missing savedAt." };
  }
  if (
    raw.documentFileName !== null &&
    typeof raw.documentFileName !== "string"
  ) {
    return { ok: false, reason: "Autosave documentFileName is invalid." };
  }
  if (typeof raw.lastCleanFingerprint !== "string") {
    return { ok: false, reason: "Autosave missing lastCleanFingerprint." };
  }
  if (typeof raw.contentFingerprint !== "string") {
    return { ok: false, reason: "Autosave missing contentFingerprint." };
  }

  const documentOutcome = parseSketchDocument(raw.document);
  if (!documentOutcome.ok) {
    return { ok: false, reason: documentOutcome.reason };
  }

  return {
    ok: true,
    envelope: {
      envelopeVersion: AUTOSAVE_ENVELOPE_VERSION,
      sketchSchemaVersion: SKETCH_SCHEMA_VERSION,
      savedAt: raw.savedAt,
      documentFileName: raw.documentFileName,
      lastCleanFingerprint: raw.lastCleanFingerprint,
      contentFingerprint: raw.contentFingerprint,
      document: documentOutcome.document,
    },
  };
}

export function readAutosaveStore(store: AutosaveStore): AutosaveReadOutcome {
  const text = store.read();
  if (text === null || text.length === 0) {
    return { ok: false, reason: "No autosave present." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, reason: "Autosave is not valid JSON." };
  }
  return parseAutosaveEnvelope(raw);
}

export function writeAutosaveStore(
  store: AutosaveStore,
  sketch: Sketch,
  options: {
    readonly documentFileName: string | null;
    readonly lastCleanFingerprint: string;
    readonly savedAt?: string;
  },
): void {
  const envelope = buildAutosaveEnvelope(sketch, options);
  store.write(serializeAutosaveEnvelope(envelope));
}

export function clearAutosaveStore(store: AutosaveStore): void {
  store.clear();
}

/** Offer recovery when the slot holds a sketch that differs from a clean empty doc. */
export function shouldOfferRecovery(envelope: AutosaveEnvelope): boolean {
  const emptyFp = emptySketchCleanFingerprint();
  if (envelope.contentFingerprint === emptyFp) {
    return false;
  }
  return (
    envelope.contentFingerprint !== envelope.lastCleanFingerprint ||
    envelope.document.geometry.length > 0 ||
    envelope.document.constraints.length > 0
  );
}

export function restoreSketchFromEnvelope(
  envelope: AutosaveEnvelope,
): SketchParseOutcome {
  return parseSketchDocument(envelope.document);
}

export function createMemoryAutosaveStore(
  initial: string | null = null,
): AutosaveStore & { readonly snapshots: string[] } {
  let value = initial;
  const snapshots: string[] = [];
  return {
    snapshots,
    read() {
      return value;
    },
    write(text) {
      value = text;
      snapshots.push(text);
    },
    clear() {
      value = null;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
