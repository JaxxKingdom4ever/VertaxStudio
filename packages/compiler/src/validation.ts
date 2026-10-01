import type { Diagnostic } from "../../core-types/src/index.js";
import type { RuntimeState } from "../../runtime/src/index.js";
export function validateStageCompletion(state: RuntimeState): readonly Diagnostic[] {
  return Object.values(state.requirements).filter(r=>r.status==="OPEN").map(r=>({severity:"Error",code:"UNRESOLVED_REQUIREMENT",message:`Requirement ${r.id} remains open.`,scopeId:r.ownerScopeId}));
}
