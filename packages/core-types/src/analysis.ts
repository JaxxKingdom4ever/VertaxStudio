import type { FeatureBundle } from "./features.js";
import type { StableId } from "./ids.js";
import type { ProvenanceRef } from "./trace.js";
import type { SemanticGraph } from "./semantic.js";

/** Analysis values use an explicit tag to distinguish source text from surface output. */
export interface SourceText {
  readonly valueType: "SourceText";
  readonly id: StableId;
  readonly text: string;
  readonly provenance?: readonly ProvenanceRef[];
}
export interface OrthographicToken {
  readonly id: StableId;
  readonly text: string;
  readonly normalized: string;
  readonly start: number;
  readonly end: number;
}
export interface OrthographicTokenSequence {
  readonly valueType: "OrthographicTokenSequence";
  readonly id: StableId;
  readonly tokens: readonly OrthographicToken[];
}
export interface LexicalOption {
  readonly lexemeId: StableId;
  readonly conceptId: StableId;
  readonly lexicalClass: string;
  readonly formKey: string;
}
export interface AnalyzedToken {
  readonly token: OrthographicToken;
  readonly options: readonly LexicalOption[];
}
export interface MorphAnalysis {
  readonly valueType: "MorphAnalysis";
  readonly id: StableId;
  readonly tokens: readonly AnalyzedToken[];
  readonly features: FeatureBundle;
}
export interface SyntacticAnalysis {
  readonly valueType: "SyntacticAnalysis";
  readonly id: StableId;
  readonly rootId: StableId;
  readonly nodes: Readonly<Record<StableId, Readonly<Record<string, unknown>>>>;
}
export interface SemanticGraphValue {
  readonly valueType: "SemanticGraphValue";
  readonly id: StableId;
  readonly graph: SemanticGraph;
  readonly provenance?: readonly ProvenanceRef[];
}
export type AnalysisValue = SourceText | OrthographicTokenSequence | MorphAnalysis | SyntacticAnalysis | SemanticGraphValue;