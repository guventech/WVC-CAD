const INSTANCE_STORAGE_KEY = "wvc-cad.instance.v1";

/** Stable per-tab/window id for multi-instance autosave awareness. */
export function getAutosaveInstanceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }
  try {
    const existing = window.sessionStorage.getItem(INSTANCE_STORAGE_KEY);
    if (existing !== null && existing.length > 0) {
      return existing;
    }
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `instance-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(INSTANCE_STORAGE_KEY, id);
    return id;
  } catch {
    return `ephemeral-${Date.now()}`;
  }
}
