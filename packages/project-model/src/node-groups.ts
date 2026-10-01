import type { StableId } from "../../core-types/src/index.js";
import type { GraphDefinition, PortDefinition } from "../../runtime/src/index.js";
import { decodeStageGraphDocument } from "./graph-documents.js";
import type { DecodeResult } from "./model.js";

export interface NodeGroupParameterDefinition {
  readonly id:string; readonly label:string; readonly valueType:"string"|"number"|"boolean"|"json"; readonly required:boolean; readonly defaultValue?:unknown;
}
export interface NodeGroupDocument {
  readonly schema_version:1; readonly id:StableId; readonly name:string; readonly version:string; readonly description?:string;
  readonly inputs:readonly PortDefinition[]; readonly outputs:readonly PortDefinition[]; readonly parameters:readonly NodeGroupParameterDefinition[];
  readonly internal_graph:GraphDefinition; readonly test_ids:readonly StableId[];
}
function rec(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v)}
function str(v:unknown):v is string{return typeof v==="string"}
function strs(v:unknown):v is string[]{return Array.isArray(v)&&v.every(str)}
function port(v:unknown,dir:"input"|"output"):v is PortDefinition{return rec(v)&&str(v.id)&&v.direction===dir&&strs(v.acceptedTypes)&&(["ONE","OPTIONAL","MANY"] as unknown[]).includes(v.cardinality)&&typeof v.required==="boolean"}
function param(v:unknown):v is NodeGroupParameterDefinition{return rec(v)&&str(v.id)&&str(v.label)&&(["string","number","boolean","json"] as unknown[]).includes(v.valueType)&&typeof v.required==="boolean"}
function fail(message:string):DecodeResult<NodeGroupDocument>{return {diagnostics:[{severity:"Error",code:"INVALID_NODE_GROUP",message}]}}
export function decodeNodeGroupDocument(raw:unknown):DecodeResult<NodeGroupDocument>{
  if(!rec(raw)||raw.schema_version!==1||!str(raw.id)||!str(raw.name)||!str(raw.version)||(raw.description!==undefined&&!str(raw.description))||!Array.isArray(raw.inputs)||!raw.inputs.every(x=>port(x,"input"))||!Array.isArray(raw.outputs)||!raw.outputs.every(x=>port(x,"output"))||!Array.isArray(raw.parameters)||!raw.parameters.every(param)||!strs(raw.test_ids))return fail("Node Group document is invalid.");
  const graph=decodeStageGraphDocument({schema_version:1,stage:"Utility",graph:raw.internal_graph,rules:[]});
  if(!graph.value)return fail("Node Group internal graph is invalid.");
  return {value:raw as unknown as NodeGroupDocument,diagnostics:[]};
}
export function serializeNodeGroupDocument(document:NodeGroupDocument):string{return JSON.stringify(document,null,2)+"\n"}
export function parseNodeGroupDocument(text:string):DecodeResult<NodeGroupDocument>{try{return decodeNodeGroupDocument(JSON.parse(text))}catch{return fail("Node Group JSON could not be parsed.")}}
