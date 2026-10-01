import type { CompilerStage, CompilerValue, DebugTraceFrame, DebugRuntimeSnapshot, DebugRequirementSnapshot, StableId } from '../../core-types/src/index.js';
export interface TraceRow {readonly index:number;readonly stage:CompilerStage;readonly ruleId:string;readonly graphId:string;readonly nodeIds:readonly StableId[];readonly reason:string;readonly breakpoint:boolean;}
export interface ScopeTreeNode {readonly id:StableId;readonly type:string;readonly status:string;readonly current:boolean;readonly children:readonly ScopeTreeNode[];}
export function buildTraceRows(frames:readonly DebugTraceFrame[],breakpoints:readonly StableId[]):readonly TraceRow[]{
 const set=new Set(breakpoints);
 return frames.map((f,index)=>({index,stage:f.stage,ruleId:f.ruleId,graphId:f.graphId,nodeIds:f.trace.nodeIds??[],reason:f.trace.reason,breakpoint:(f.trace.nodeIds??[]).some(id=>set.has(id))}));
}
export const findFirstBreakpointHit=(frames:readonly DebugTraceFrame[],ids:readonly StableId[]):number|undefined=>{
 const index=buildTraceRows(frames,ids).findIndex(row=>row.breakpoint);
 return index<0?undefined:index;
};
export function inspectTraceValue(frame:DebugTraceFrame,phase:'before'|'after',id:StableId):CompilerValue|undefined {
 return (phase==='before'?frame.beforeState:frame.afterState).values.find(v=>v.id===id);
}
const snapshot=(frame:DebugTraceFrame,phase:'before'|'after'):DebugRuntimeSnapshot=>phase==='before'?frame.beforeState:frame.afterState;
export function buildScopeTree(frame:DebugTraceFrame,phase:'before'|'after'):readonly ScopeTreeNode[]{
 const data=snapshot(frame,phase);
 const walk=(id:string,seen:Set<string>):ScopeTreeNode|undefined=>{
   const scope=data.scopes.find(s=>s.id===id);if(!scope||seen.has(id))return undefined;
   const path=new Set(seen);path.add(id);
   return {id,type:scope.type,status:scope.status,current:data.currentScopeId===id,children:scope.childIds.map(child=>walk(child,path)).filter((x):x is ScopeTreeNode=>x!==undefined)};
 };
 return data.scopes.filter(scope=>!scope.parentId).map(scope=>walk(scope.id,new Set())).filter((x):x is ScopeTreeNode=>x!==undefined);
}
export const openRequirements=(frame:DebugTraceFrame,phase:'before'|'after'):readonly DebugRequirementSnapshot[]=>snapshot(frame,phase).requirements.filter(r=>r.status==='OPEN');
