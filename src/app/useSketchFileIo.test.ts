import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmDiscardUnsavedChanges } from "./useSketchFileIo.ts";

describe("confirmDiscardUnsavedChanges", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows replace when the document is clean", () => {
    const confirm = vi.spyOn(window, "confirm");
    expect(confirmDiscardUnsavedChanges(false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks before replacing a dirty document and honors cancel", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(confirmDiscardUnsavedChanges(true)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("asks before replacing a dirty document and honors confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    expect(confirmDiscardUnsavedChanges(true)).toBe(true);
  });
});
