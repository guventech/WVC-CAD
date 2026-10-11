import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLocalStorageAutosaveStore,
  isQuotaExceeded,
} from "./localStorageAutosaveStore.ts";

describe("localStorageAutosaveStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("reports quota exceeded without throwing", () => {
    const quotaError = new DOMException(
      "The quota has been exceeded.",
      "QuotaExceededError",
    );
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw quotaError;
      },
      removeItem: () => undefined,
    });

    const store = createLocalStorageAutosaveStore("test-autosave");
    const result = store.write("{}");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toMatch(/quota/i);
    expect(isQuotaExceeded(quotaError)).toBe(true);
  });

  it("reports unavailable storage without throwing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });

    const store = createLocalStorageAutosaveStore("test-autosave");
    expect(store.read()).toBeNull();
    const result = store.write("{}");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toMatch(/unavailable/i);
  });
});
