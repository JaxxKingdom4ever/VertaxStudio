export * from "./ids.js";
export * from "./features.js";
export * from "./diagnostics.js";
export * from "./trace.js";
export * from "./semantic.js";
export * from "./grammar.js";
export * from "./morphology.js";
export * from "./phonology.js";
export * from "./analysis.js";

import type { GrammarStructure, SurfaceForm } from "./grammar.js";
import type { MorphSequence } from "./morphology.js";
import type { PhonologicalForm } from "./phonology.js";
import type { SemanticObject } from "./semantic.js";
import type { AnalysisValue } from "./analysis.js";

export type CompilerValue = SemanticObject | GrammarStructure | MorphSequence | PhonologicalForm | SurfaceForm | AnalysisValue;

export function compilerValueType(value: CompilerValue): string {
  if ("valueType" in value) return value.valueType;
  if ("type" in value) return value.type;
  if ("kind" in value) return value.kind;
  if ("morphs" in value) return "MorphSequence";
  return "SurfaceForm";
}
