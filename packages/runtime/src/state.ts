import type { SemanticGraph, StableId } from "../../core-types/src/index.js";
import type { Requirement } from "./requirements.js";
import type { Scope } from "./scopes.js";

export interface RuntimeState {
  readonly semanticGraph: SemanticGraph;
  readonly scopes: Readonly<Record<StableId, Scope>>;
  readonly requirements: Readonly<Record<StableId, Requirement>>;
  readonly currentScopeId: StableId;
}

export function createRuntimeState(graph: SemanticGraph): RuntimeState {
  const rootId = "scope:root";
  return {
    semanticGraph: graph,
    currentScopeId: rootId,
    scopes: {
      [rootId]: {
        id: rootId,
        type: "Root",
        childIds: [],
        requirementIds: [],
        status: "OPEN"
      }
    },
    requirements: {}
  };
}
