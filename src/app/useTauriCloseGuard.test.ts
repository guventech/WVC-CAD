import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTauriCloseGuard } from "./useTauriCloseGuard.ts";

describe("useTauriCloseGuard", () => {
  it("is a no-op outside Tauri (does not throw)", () => {
    const flush = vi.fn();
    expect(() => {
      renderHook(() =>
        useTauriCloseGuard({
          hasUnsavedChanges: true,
          flushAutosave: flush,
        }),
      );
    }).not.toThrow();
    expect(flush).not.toHaveBeenCalled();
  });
});
