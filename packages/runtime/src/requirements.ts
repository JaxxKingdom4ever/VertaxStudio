import {
  compilerValueType,
  type CompilerValue,
  type Diagnostic,
  type StableId
} from "../../core-types/src/index.js";
import type { RuntimeState } from "./state.js";

export interface Requirement {
  readonly id: StableId;
  readonly ownerScopeId: StableId;
  readonly creatorId: StableId;
  readonly acceptedTypes: readonly string[];
  readonly status: "OPEN" | "RESOLVED" | "FAILED";
  readonly resolutionId?: StableId;
}

export interface OpenRequirementSpec {
  readonly id: StableId;
  readonly creatorId: StableId;
  readonly acceptedTypes: readonly string[];
  readonly ownerScopeId?: StableId;
}

export interface ResolveRequirementResult {
  readonly state: RuntimeState;
  readonly diagnostics: readonly Diagnostic[];
}

export function openRequirement(state: RuntimeState, spec: OpenRequirementSpec): RuntimeState {
  const ownerScopeId = spec.ownerScopeId ?? state.currentScopeId;
  const scope = state.scopes[ownerScopeId];
  if (!scope) throw new Error(`Requirement owner scope ${ownerScopeId} does not exist.`);
  const requirement: Requirement = {
    id: spec.id,
    ownerScopeId,
    creatorId: spec.creatorId,
    acceptedTypes: [...spec.acceptedTypes],
    status: "OPEN"
  };
  return {
    ...state,
    scopes: {
      ...state.scopes,
      [ownerScopeId]: { ...scope, requirementIds: [...scope.requirementIds, requirement.id] }
    },
    requirements: { ...state.requirements, [requirement.id]: requirement }
  };
}

export function resolveRequirement(
  state: RuntimeState,
  requirementId: StableId,
  resolution: CompilerValue
): ResolveRequirementResult {
  const requirement = state.requirements[requirementId];
  if (!requirement) {
    return {
      state,
      diagnostics: [{ severity: "Error", code: "UNKNOWN_REQUIREMENT", message: `Requirement ${requirementId} does not exist.` }]
    };
  }
  const actualType = compilerValueType(resolution);
  if (!requirement.acceptedTypes.includes(actualType)) {
    return {
      state,
      diagnostics: [{
        severity: "Error",
        code: "REQUIREMENT_TYPE_MISMATCH",
        message: `Requirement ${requirementId} accepts ${requirement.acceptedTypes.join(", ")}, received ${actualType}.`,
        scopeId: requirement.ownerScopeId
      }]
    };
  }
  return {
    state: {
      ...state,
      requirements: {
        ...state.requirements,
        [requirementId]: { ...requirement, status: "RESOLVED", resolutionId: resolution.id }
      }
    },
    diagnostics: []
  };
}
