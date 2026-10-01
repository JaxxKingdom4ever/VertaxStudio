import type { StableId } from '../../core-types/src/index.js';
import type { GraphNode } from '../../runtime/src/index.js';
import type { EditResult, StudioState } from './model.js';
import { selectedGraphDocument, selectedGraphLayout } from './project-session.js';
import { activeGraphDefinition, replaceActiveGraphDefinition } from './hierarchy.js';

export interface NodeCatalogEntry {
  readonly id:string;
  readonly label:string;
  readonly typeId:string;
  readonly source:'primitive'|'node-group';
  readonly category?:string;
  readonly keywords:readonly string[];
  readonly description?:string;
  readonly groupId?:StableId;
}
export function nodeGroupTypeId(groupId:StableId):string{return `node-group:${groupId}`}
export function parseNodeGroupTypeId(typeId:string):StableId|undefined{return typeId.startsWith('node-group:')?typeId.slice('node-group:'.length)||undefined:undefined}
function words(value:string):string[]{return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)}
export function buildNodeCatalog(state:StudioState):readonly NodeCatalogEntry[]{
  const primitives=state.nodeDefinitions.map(def=>({id:`primitive:${def.typeId}`,label:def.authoring?.label??def.typeId,typeId:def.typeId,source:'primitive' as const,category:def.authoring?.category??'Primitives',description:def.authoring?.description,keywords:[def.typeId,...words(def.typeId),...(def.authoring?.keywords??[]),...words(def.authoring?.label??'')]}));
  const groups=Object.values(state.project.nodeGroups).map(group=>({id:`group:${group.id}`,label:group.name,typeId:nodeGroupTypeId(group.id),source:'node-group' as const,keywords:[group.name,group.id,...words(group.name)],description:group.description,groupId:group.id}));
  return [...primitives,...groups];
}
function nextNodeId(existing:readonly GraphNode[]):StableId{let n=existing.length+1;while(existing.some(node=>node.id===`studio-node-${n}`))n++;return `studio-node-${n}`}
export function addCatalogNode(state:StudioState,entry:NodeCatalogEntry|undefined,position:{x:number;y:number}):EditResult{
  if(!entry)return {state,diagnostics:[{severity:'Error',code:'MISSING_CATALOG_ENTRY',message:'Node catalog entry was not found.'}]};
  const graph=activeGraphDefinition(state);if(!graph)return {state,diagnostics:[{severity:'Error',code:'NO_ACTIVE_GRAPH',message:'No graph selected.'}]};
  const id=nextNodeId(graph.nodes);let params:Readonly<Record<string,unknown>>={};
  if(entry.source==='node-group'&&entry.groupId){const group=state.project.nodeGroups[entry.groupId];if(!group)return {state,diagnostics:[{severity:'Error',code:'MISSING_NODE_GROUP_REFERENCE',message:`Node Group ${entry.groupId} is missing.`}]};params=Object.fromEntries(group.parameters.filter(p=>p.defaultValue!==undefined).map(p=>[p.id,p.defaultValue]))}
  const node:GraphNode={id,typeId:entry.typeId,params};
  let next=replaceActiveGraphDefinition(state,{...graph,nodes:[...graph.nodes,node]});
  if((state.graphSelection?.nodeGroupPath.length??0)===0){const document=selectedGraphDocument(state)!;const baseLayout=selectedGraphLayout(state)??{schema_version:1 as const,graph_id:document.graph.id,nodes:{}};const layout={...baseLayout,nodes:{...baseLayout.nodes,[id]:position}};next={...next,project:{...next.project,layouts:{...next.project.layouts,[document.graph.id]:layout}}}}
  return {state:{...next,selection:{kind:'node',id},dirty:true},diagnostics:[]};
}
