import type { CompilerValue, DebugRuntimeSnapshot } from '../../core-types/src/index.js';
import type { RuntimeState } from '../../runtime/src/index.js';

/** A trace view is observational: no object in a snapshot aliases mutable compiler state. */
function freezeRecursively<T>(value:T):T {
  if(value!==null && typeof value==='object' && !Object.isFrozen(value)) {
    for(const child of Object.values(value))freezeRecursively(child);
    Object.freeze(value);
  }
  return value;
}
export function snapshotDebugState(state:RuntimeState,values:readonly CompilerValue[]):DebugRuntimeSnapshot {
  return freezeRecursively({
    currentScopeId:state.currentScopeId,
    values:structuredClone(values),
    scopes:Object.values(state.scopes).sort((a,b)=>a.id.localeCompare(b.id)).map(scope=>({
      id:scope.id,type:scope.type,parentId:scope.parentId,
      childIds:[...scope.childIds],requirementIds:[...scope.requirementIds],status:scope.status
    })),
    requirements:Object.values(state.requirements).sort((a,b)=>a.id.localeCompare(b.id)).map(req=>({
      id:req.id,ownerScopeId:req.ownerScopeId,creatorId:req.creatorId,
      acceptedTypes:[...req.acceptedTypes],status:req.status,resolutionId:req.resolutionId
    }))
  });
}
