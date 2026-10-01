import {validateSemanticGraph, type CompilerStage, type CompilerValue, type DebugTraceFrame, type Diagnostic, type ProvenanceRef, type SemanticGraph, type SemanticGraphValue, type SourceText, type TraceStep } from "../../core-types/src/index.js";
import {createRuntimeState, type NodeRegistry} from "../../runtime/src/index.js";
import type {ProjectResources} from "../../primitives/src/index.js";
import {compileStage, type StageProject, type StageResult} from "./stage.js";

export interface AnalyzerProject {
  readonly orthography: StageProject;
  readonly morphology: StageProject;
  readonly grammar: StageProject;
  readonly meaning: StageProject;
  readonly resources: ProjectResources;
}
export interface AnalysisCandidate {readonly id:string;readonly meaning:SemanticGraph;readonly provenance:readonly ProvenanceRef[];}
export interface AnalyzeOptions {readonly mode:"fast"|"trace"|"strict";readonly maxStepsPerStage:number;}
export interface AnalysisResult {
  readonly success:boolean;
  readonly candidates:readonly AnalysisCandidate[];
  readonly diagnostics:readonly Diagnostic[];
  readonly trace:readonly TraceStep[];
  readonly debugFrames:readonly DebugTraceFrame[];
  readonly stageResults:Readonly<Partial<Record<CompilerStage,StageResult>>>;
}
function normalize(input:unknown):unknown {
  if(Array.isArray(input))return input.map(normalize);
  // Provenance records where an interpretation came from; they do not change its meaning.
  if(input&&typeof input==="object")return Object.fromEntries(Object.entries(input as Record<string,unknown>).filter(([key])=>key!=="provenance").sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,normalize(v)]));
  return input;
}
/** Stable browser-safe hash. Structural equality, not text equality, controls deduplication. */
export function semanticFingerprint(graph:SemanticGraph):string {
  const json=JSON.stringify(normalize(graph));
  let hash=0xcbf29ce484222325n;
  for(let i=0;i<json.length;i++){hash=BigInt.asUintN(64,(hash^BigInt(json.charCodeAt(i)))*0x100000001b3n);}
  return `meaning:${hash.toString(16).padStart(16,"0")}`;
}
const error=(code:string,message:string):Diagnostic=>({severity:"Error",code,message});
export function analyzeSurface(project:AnalyzerProject,registry:NodeRegistry,text:string,options:AnalyzeOptions):AnalysisResult {
  const diagnostics:Diagnostic[]=[];
  const trace:TraceStep[]=[];
  const debugFrames:DebugTraceFrame[]=[];
  const stageResults:Partial<Record<CompilerStage,StageResult>>={};
  const start:SourceText={valueType:"SourceText",id:"source:root",text};
  let values:readonly CompilerValue[]=[start];
  let state=createRuntimeState({roots:[],objects:{}});
  const stages=[project.orthography,project.morphology,project.grammar,project.meaning];
  for(const [index,stage] of stages.entries()){
    const result=compileStage(stage,registry,state,values,{trace:options.mode!=="fast",maxSteps:options.maxStepsPerStage,resources:project.resources});
    diagnostics.push(...result.diagnostics);trace.push(...result.trace);debugFrames.push(...result.debugFrames);
    stageResults[stage.stage]=result;
    state=result.state;values=result.values;
    if(!result.success)return {success:false,candidates:[],diagnostics,trace,debugFrames,stageResults};
    if(values.length===0){diagnostics.push(error("NO_ANALYSIS_CANDIDATES",`Stage ${stage.stage} produced no hypotheses.`));return {success:false,candidates:[],diagnostics,trace,debugFrames,stageResults};}
    if(index===stages.length-1&&values.some(v=>!("valueType" in v)||v.valueType!=="SemanticGraphValue"))diagnostics.push(error("INVALID_ANALYSIS_OUTPUT","MeaningAnalysis must return only SemanticGraphValue hypotheses."));
  }
  if(diagnostics.some(d=>d.severity==="Error"||d.severity==="Fatal"))return {success:false,candidates:[],diagnostics,trace,debugFrames,stageResults};
  const dedup=new Map<string,AnalysisCandidate>();
  for(const value of values as SemanticGraphValue[]){
    const problems=validateSemanticGraph(value.graph);
    if(problems.length){diagnostics.push(...problems);continue;}
    const id=semanticFingerprint(value.graph);
    if(!dedup.has(id))dedup.set(id,{id,meaning:value.graph,provenance:value.provenance??[]});
  }
  const candidates=[...dedup.values()].sort((a,b)=>a.id.localeCompare(b.id));
  if(!candidates.length)diagnostics.push(error("NO_ANALYSIS_CANDIDATES","No valid semantic interpretation was produced."));
  return {success:!diagnostics.some(d=>d.severity==="Error"||d.severity==="Fatal"),candidates,diagnostics,trace,debugFrames,stageResults};
}