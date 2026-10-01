import type { StableId } from "./ids.js";
import type { CompilerValue } from "./index.js";

export interface ProvenanceRef {
  readonly kind: "Explicit" | "Inferred" | "Contextual" | "Default" | "UserSupplied" | "Transform";
  readonly sourceId?: StableId;
  readonly note?: string;
}

export type CompilerStage = "Meaning" | "Grammar" | "Morphology" | "Phonology" | "Surface" | "Utility"
  | "OrthographyAnalysis" | "MorphologyAnalysis" | "GrammarAnalysis" | "MeaningAnalysis";

export interface TraceStep {
  readonly step: number;
  readonly stage: CompilerStage;
  readonly ruleId?: StableId;
  readonly graphId?: StableId;
  readonly nodeIds?: readonly StableId[];
  readonly scopeId?: StableId;
  readonly beforeFingerprint?: string;
  readonly afterFingerprint?: string;
  readonly reason: string;
}

export interface DebugScopeSnapshot {
  readonly id: StableId;
  readonly type: string;
  readonly parentId?: StableId;
  readonly childIds: readonly StableId[];
  readonly requirementIds: readonly StableId[];
  readonly status: "OPEN" | "RESOLVED" | "FAILED";
}
export interface DebugRequirementSnapshot {
  readonly id: StableId;
  readonly ownerScopeId: StableId;
  readonly creatorId: StableId;
  readonly acceptedTypes: readonly string[];
  readonly status: "OPEN" | "RESOLVED" | "FAILED";
  readonly resolutionId?: StableId;
}
export interface DebugRuntimeSnapshot {
  readonly currentScopeId: StableId;
  readonly values: readonly CompilerValue[];
  readonly scopes: readonly DebugScopeSnapshot[];
  readonly requirements: readonly DebugRequirementSnapshot[];
}
export interface DebugTraceFrame {
  readonly stage: CompilerStage;
  readonly ruleId: StableId;
  readonly graphId: StableId;
  readonly trace: TraceStep;
  readonly beforeState: DebugRuntimeSnapshot;
  readonly afterState: DebugRuntimeSnapshot;
  /** Compatibility accessors retained for older analysis/Studio callers. */
  readonly before: readonly CompilerValue[];
  readonly after: readonly CompilerValue[];
  readonly scopeId: StableId;
  readonly requirements: Readonly<Record<string, unknown>>;
}
