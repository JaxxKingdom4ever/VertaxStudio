import type { StableId } from "./ids.js";

export type DiagnosticSeverity = "Info" | "Warning" | "Error" | "Fatal";

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly objectId?: StableId;
  readonly nodeId?: StableId;
  readonly scopeId?: StableId;
}
