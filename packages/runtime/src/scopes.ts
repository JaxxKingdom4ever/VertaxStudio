import type { StableId } from "../../core-types/src/index.js";
import type { RuntimeState } from "./state.js";

export interface Scope {
  readonly id: StableId;
  readonly type: string;
  readonly parentId?: StableId;
  readonly childIds: readonly StableId[];
  readonly requirementIds: readonly StableId[];
  readonly status: "OPEN" | "RESOLVED" | "FAILED";
}

export interface OpenScopeSpec {
  readonly id: StableId;
  readonly type: string;
}

export function openScope(state: RuntimeState, spec: OpenScopeSpec): RuntimeState {
  const parent = state.scopes[state.currentScopeId];
  if (!parent) throw new Error(`Current scope ${state.currentScopeId} does not exist.`);
  const child: Scope = {
    id: spec.id,
    type: spec.type,
    parentId: parent.id,
    childIds: [],
    requirementIds: [],
    status: "OPEN"
  };
  return {
    ...state,
    currentScopeId: child.id,
    scopes: {
      ...state.scopes,
      [parent.id]: { ...parent, childIds: [...parent.childIds, child.id] },
      [child.id]: child
    }
  };
}

export function closeScope(state: RuntimeState, scopeId: StableId): RuntimeState {
  const scope = state.scopes[scopeId];
  if (!scope) return state;
  const hasUnresolvedRequirements=scope.requirementIds.some(id=>state.requirements[id]?.status!=="RESOLVED");
  return {
    ...state,
    currentScopeId: scope.parentId ?? state.currentScopeId,
    scopes: {
      ...state.scopes,
      [scopeId]: { ...scope, status: hasUnresolvedRequirements?"FAILED":"RESOLVED" }
    }
  };
}
