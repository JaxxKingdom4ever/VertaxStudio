import type { Diagnostic, FeatureDefinition, StableId } from "../../core-types/src/index.js";
import type { ConceptDefinition, DataTable, Lexeme } from "../../primitives/src/index.js";
import type { StageGraphDocument, GraphLayoutDocument } from "./graph-documents.js";
import type { ProjectManifest } from "./manifest.js";
import type { NodeGroupDocument } from "./node-groups.js";
import type { PersistedTestDocument } from "./tests-model.js";
export type { FeatureDefinition } from "../../core-types/src/index.js";
export type { ConceptDefinition, DataTable, Lexeme, ProjectResources, ValencySlot } from "../../primitives/src/index.js";

export interface DecodeResult<T> { readonly value?: T; readonly diagnostics: readonly Diagnostic[]; }
export interface LoadedVertaxProject {
  readonly manifest: ProjectManifest;
  readonly concepts: Readonly<Record<StableId,ConceptDefinition>>;
  readonly features: Readonly<Record<StableId,FeatureDefinition>>;
  readonly lexemes: Readonly<Record<StableId,Lexeme>>;
  readonly tables: Readonly<Record<StableId,DataTable>>;
  readonly stageDocuments: readonly StageGraphDocument[];
  readonly layouts: Readonly<Record<StableId,GraphLayoutDocument>>;
  readonly nodeGroups: Readonly<Record<StableId,NodeGroupDocument>>;
  readonly tests: Readonly<Record<StableId,PersistedTestDocument>>;
  readonly settings: Readonly<Record<string,unknown>>;
}
