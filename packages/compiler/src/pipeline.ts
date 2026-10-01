import {
  validateSemanticGraph,
  type CompilerStage,
  type CompilerValue,
  type Diagnostic,
  type DebugTraceFrame,
  type SemanticGraph,
  type SurfaceForm,
  type TraceStep
} from "../../core-types/src/index.js";
import { createRuntimeState, type NodeRegistry } from "../../runtime/src/index.js";
import type { ProjectResources } from "../../primitives/src/index.js";
import { compileStage, type StageProject, type StageResult } from "./stage.js";

export interface CompilerProject {
  readonly grammar: StageProject;
  readonly morphology: StageProject;
  readonly phonology?: StageProject;
  readonly surface: StageProject;
  readonly resources: ProjectResources;
}
export interface CompileOptions { readonly mode: "fast" | "trace" | "strict"; readonly maxStepsPerStage: number; }
export interface CompileResult {
  readonly success: boolean;
  readonly surface?: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly trace: readonly TraceStep[];
  readonly debugFrames: readonly DebugTraceFrame[];
  readonly stageResults: Readonly<Partial<Record<CompilerStage, StageResult>>>;
}
function hasError(ds:readonly Diagnostic[]):boolean { return ds.some(d=>d.severity==="Error"||d.severity==="Fatal"); }
export function compileMeaningGraph(project:CompilerProject, registry:NodeRegistry, graph:SemanticGraph, options:CompileOptions):CompileResult {
  const diagnostics:Diagnostic[]=[...validateSemanticGraph(graph)];
  const trace:TraceStep[]=[]; const debugFrames:DebugTraceFrame[]=[]; const stageResults:Partial<Record<CompilerStage,StageResult>>={};
  if(hasError(diagnostics)) return {success:false,diagnostics,trace,debugFrames,stageResults};
  let state=createRuntimeState(graph);
  let values:CompilerValue[]=graph.roots.map(id=>graph.objects[id]!).filter(Boolean);
  for(const stageProject of [project.grammar,project.morphology,...(project.phonology?[project.phonology]:[]),project.surface]){
    const result=compileStage(stageProject,registry,state,values,{maxSteps:options.maxStepsPerStage,trace:options.mode!=="fast",resources:project.resources});
    stageResults[stageProject.stage]=result; diagnostics.push(...result.diagnostics); if(options.mode!=="fast"){trace.push(...result.trace);debugFrames.push(...result.debugFrames);}
    state=result.state; values=[...result.values]; if(!result.success) return {success:false,diagnostics,trace,debugFrames,stageResults};
  }
  const forms=values.filter(v=>"text" in v) as SurfaceForm[];
  if(forms.length!==values.length){ diagnostics.push({severity:"Error",code:"INVALID_SURFACE_OUTPUT",message:"Surface stage emitted non-surface values."}); return {success:false,diagnostics,trace,debugFrames,stageResults}; }
  return {success:true,surface:forms.map(f=>f.text).join(" "),diagnostics,trace,debugFrames,stageResults};
}
