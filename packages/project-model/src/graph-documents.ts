import type { CompilerStage, StableId } from "../../core-types/src/index.js";
import type { GraphDefinition, GraphEdge, GraphNode, GraphPortBinding, RuleDefinition, MatcherExpr } from "../../runtime/src/index.js";
import type { DecodeResult } from "./model.js";

export interface StageGraphDocument { readonly schema_version:1; readonly stage:CompilerStage; readonly graph:GraphDefinition; readonly rules:readonly RuleDefinition[]; }
export interface NodeLayout { readonly x:number; readonly y:number; readonly width?:number; readonly height?:number; }
export interface ViewportLayout { readonly x:number; readonly y:number; readonly zoom:number; }
export interface GraphLayoutDocument { readonly schema_version:1; readonly graph_id:StableId; readonly nodes:Readonly<Record<StableId,NodeLayout>>; readonly viewport?:ViewportLayout; }
const stages=new Set<CompilerStage>(["Meaning","Grammar","Morphology","Phonology","Surface","Utility","OrthographyAnalysis","MorphologyAnalysis","GrammarAnalysis","MeaningAnalysis"]);
function rec(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v)}
function str(v:unknown):v is string{return typeof v==="string"}
function num(v:unknown):v is number{return typeof v==="number"&&Number.isFinite(v)}
function matcher(v:unknown):v is MatcherExpr{ if(!rec(v)||!str(v.kind)) return false; if(v.kind==="type")return str(v.type); if(v.kind==="featureEquals")return str(v.featureId)&&"value" in v; if(v.kind==="roleExists")return str(v.role); if(v.kind==="all"||v.kind==="any")return Array.isArray(v.matchers)&&v.matchers.every(matcher); return false; }
function graphNode(v:unknown):v is GraphNode{return rec(v)&&str(v.id)&&str(v.typeId)&&rec(v.params)}
function edge(v:unknown):v is GraphEdge{return rec(v)&&[v.sourceNodeId,v.sourcePortId,v.targetNodeId,v.targetPortId].every(str)}
function binding(v:unknown):v is GraphPortBinding{return rec(v)&&[v.graphPortId,v.nodeId,v.nodePortId].every(str)}
function graph(v:unknown):v is GraphDefinition{return rec(v)&&str(v.id)&&Array.isArray(v.nodes)&&v.nodes.every(graphNode)&&Array.isArray(v.edges)&&v.edges.every(edge)&&Array.isArray(v.exposedInputs)&&v.exposedInputs.every(binding)&&Array.isArray(v.exposedOutputs)&&v.exposedOutputs.every(binding)}
function rule(v:unknown):v is RuleDefinition{return rec(v)&&str(v.id)&&stages.has(v.stage as CompilerStage)&&matcher(v.matcher)&&str(v.graphId)&&num(v.priority)&&typeof v.fallback==="boolean"}
function fail<T>(code:string,message:string):DecodeResult<T>{return {diagnostics:[{severity:"Error",code,message}]}}
export function decodeStageGraphDocument(raw:unknown):DecodeResult<StageGraphDocument>{ if(!rec(raw)||raw.schema_version!==1||!stages.has(raw.stage as CompilerStage)||!graph(raw.graph)||!Array.isArray(raw.rules)||!raw.rules.every(rule))return fail("INVALID_STAGE_GRAPH_DOCUMENT","Stage graph document is invalid."); return {value:raw as unknown as StageGraphDocument,diagnostics:[]}; }
export function decodeGraphLayoutDocument(raw:unknown):DecodeResult<GraphLayoutDocument>{
  if(!rec(raw)||raw.schema_version!==1||!str(raw.graph_id)||!rec(raw.nodes))return fail("INVALID_GRAPH_LAYOUT","Graph layout document is invalid.");
  for(const value of Object.values(raw.nodes)) if(!rec(value)||!num(value.x)||!num(value.y)||(value.width!==undefined&&!num(value.width))||(value.height!==undefined&&!num(value.height))) return fail("INVALID_GRAPH_LAYOUT","Graph node layout is invalid.");
  if(raw.viewport!==undefined&&(!rec(raw.viewport)||!num(raw.viewport.x)||!num(raw.viewport.y)||!num(raw.viewport.zoom))) return fail("INVALID_GRAPH_LAYOUT","Viewport layout is invalid.");
  return {value:raw as unknown as GraphLayoutDocument,diagnostics:[]};
}
