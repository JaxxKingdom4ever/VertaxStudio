import type { Diagnostic } from "./diagnostics.js";
import type { FeatureBundle } from "./features.js";
import type { StableId } from "./ids.js";
import type { ProvenanceRef } from "./trace.js";

export type SemanticType =
  | "Entity" | "Group" | "Event" | "State" | "Property" | "Relation"
  | "Quantity" | "Proposition" | "Unknown" | "Reference" | "Modality" | "SemanticList";

export interface SemanticObject {
  readonly id: StableId;
  readonly type: SemanticType;
  readonly conceptId?: StableId;
  readonly roles: Readonly<Record<string, readonly StableId[]>>;
  readonly features: FeatureBundle;
  readonly provenance?: readonly ProvenanceRef[];
}

export interface SemanticGraph {
  readonly objects: Readonly<Record<StableId, SemanticObject>>;
  readonly roots: readonly StableId[];
}

export function validateSemanticGraph(graph: SemanticGraph): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const rootId of graph.roots) {
    if (!graph.objects[rootId]) {
      diagnostics.push({
        severity: "Error",
        code: "MISSING_SEMANTIC_ROOT",
        message: `Semantic root ${rootId} does not exist.`,
        objectId: rootId
      });
    }
  }
  for (const object of Object.values(graph.objects)) {
    for (const targetIds of Object.values(object.roles)) {
      for (const targetId of targetIds) {
        if (!graph.objects[targetId]) {
          diagnostics.push({
            severity: "Error",
            code: "MISSING_SEMANTIC_REFERENCE",
            message: `${object.id} references missing semantic object ${targetId}.`,
            objectId: object.id
          });
        }
      }
    }
  }
  return diagnostics;
}
