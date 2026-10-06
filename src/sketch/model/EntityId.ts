let nextEntitySerial = 1;

export function createEntityId(prefix: string): string {
  const id = `${prefix}-${nextEntitySerial}`;
  nextEntitySerial += 1;
  return id;
}

/** Test helper to keep ids deterministic across suites. */
export function resetEntityIdCounter(value: number = 1): void {
  nextEntitySerial = value;
}
