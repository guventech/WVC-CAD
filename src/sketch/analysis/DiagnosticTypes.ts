export type DiagnosticSeverity = "ok" | "info" | "warn" | "error";
export type DiagnosticCategory = "geometry" | "constraints" | "profiles";

export interface DiagnosticFinding {
  readonly id: string;
  readonly severity: DiagnosticSeverity;
  readonly category: DiagnosticCategory;
  readonly code: string;
  readonly message: string;
  readonly entityIds?: readonly string[];
  readonly constraintIds?: readonly string[];
}
