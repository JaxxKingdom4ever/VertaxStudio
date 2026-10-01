import type { CompilerStage, CompilerValue, DebugTraceFrame, Diagnostic, StableId, TraceStep } from "../../core-types/src/index.js";
import { executeGraph, fingerprintStageState, selectRule, type GraphDefinition, type NodeRegistry, type RuleDefinition, type RuntimeState } from "../../runtime/src/index.js";
import { makeTraceStep } from "./trace-recorder.js";
import { snapshotDebugState } from "./debug-snapshot.js";
import { validateStageCompletion } from "./validation.js";

export interface StageProject { readonly stage: CompilerStage; readonly rules: readonly RuleDefinition[]; readonly graphs: Readonly<Record<StableId, GraphDefinition>>; }
export interface CompileStageOptions { readonly maxSteps: number; readonly trace: boolean; readonly resources?: unknown; }
export interface StageResult { readonly state: RuntimeState; readonly values: readonly CompilerValue[]; readonly diagnostics: readonly Diagnostic[]; readonly trace: readonly TraceStep[]; readonly debugFrames: readonly DebugTraceFrame[]; readonly success: boolean; }

function isError(d: Diagnostic): boolean { return d.severity === "Error" || d.severity === "Fatal"; }
function candidateFor(project:StageProject, values:readonly CompilerValue[]) {
  const sorted=[...values].sort((a,b)=>a.id.localeCompare(b.id));
  for(const value of sorted){ const selection=selectRule(project.rules,value); if(selection.diagnostics.length||selection.rule) return {value,selection}; }
  return undefined;
}
export function compileStage(project:StageProject, registry:NodeRegistry, initialState:RuntimeState, initialValues:readonly CompilerValue[], options:CompileStageOptions):StageResult {
  let state=initialState; let values=[...initialValues]; const diagnostics:Diagnostic[]=[]; const trace:TraceStep[]=[]; const debugFrames:DebugTraceFrame[]=[]; let steps=0;
  while(true){
    const candidate=candidateFor(project,values);
    if(!candidate) break;
    if(candidate.selection.diagnostics.length){ diagnostics.push(...candidate.selection.diagnostics); break; }
    if(steps>=options.maxSteps){ diagnostics.push({severity:"Error",code:"MAX_STAGE_STEPS_EXCEEDED",message:`Stage ${project.stage} exceeded ${options.maxSteps} steps.`}); break; }
    const rule=candidate.selection.rule!; const graph=project.graphs[rule.graphId];
    if(!graph){ diagnostics.push({severity:"Error",code:"MISSING_RULE_GRAPH",message:`Rule ${rule.id} references missing graph ${rule.graphId}.`}); break; }
    const before=fingerprintStageState(state,values);
    const beforeState=options.trace?snapshotDebugState(state,values):undefined;
    const execution=executeGraph(graph,registry,{state,resources:options.resources},{value:[candidate.value]}); diagnostics.push(...execution.diagnostics);
    if(execution.diagnostics.some(isError)) { state=execution.state; break; }
    const replacement=execution.outputs.value ?? [];
    const index=values.findIndex(v=>v.id===candidate.value.id); values=[...values.slice(0,index),...replacement,...values.slice(index+1)]; state=execution.state;
    const after=fingerprintStageState(state,values); steps++;
    if(options.trace){
      const traceStep=makeTraceStep({step:steps,stage:project.stage,ruleId:rule.id,graphId:graph.id,nodeIds:execution.nodeIds,scopeId:state.currentScopeId,beforeFingerprint:before,afterFingerprint:after,reason:`Matched rule ${rule.id}`});
      trace.push(traceStep);
      const afterState=snapshotDebugState(state,values);
      debugFrames.push(Object.freeze({stage:project.stage,ruleId:rule.id,graphId:graph.id,trace:traceStep,beforeState:beforeState!,afterState,before:beforeState!.values,after:afterState.values,scopeId:state.currentScopeId,requirements:afterState.requirements.reduce<Record<string,unknown>>((map,r)=>({...map,[r.id]:r}),{})}));
    }
    if(before===after){ diagnostics.push({severity:"Error",code:"NO_PROGRESS_RECURSION",message:`Rule ${rule.id} matched without changing stage state.`}); break; }
  }
  if(!diagnostics.some(isError)) diagnostics.push(...validateStageCompletion(state));
  return {state,values,diagnostics,trace,debugFrames,success:!diagnostics.some(isError)};
}
