import type { FeatureDefinition, StableId } from "../../core-types/src/index.js";
import type { Lexeme } from "./lexicon.js";

export interface ConceptDefinition {
  readonly id: StableId;
  readonly label: string;
  readonly description?: string;
  readonly semanticType?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface DataTable {
  readonly id: StableId;
  readonly label: string;
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ProjectResources {
  readonly concepts: Readonly<Record<StableId, ConceptDefinition>>;
  readonly featureDefinitions: Readonly<Record<StableId, FeatureDefinition>>;
  readonly lexemes: Readonly<Record<StableId, Lexeme>>;
  readonly conceptToLexemeIds: Readonly<Record<StableId, readonly StableId[]>>;
  readonly tables: Readonly<Record<StableId, DataTable>>;
}
