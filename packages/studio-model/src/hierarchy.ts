import type { StableId } from '../../core-types/src/index.js';
import type { GraphDefinition } from '../../runtime/src/index.js';
import type { EditResult, StudioState } from './model.js';
import { selectedGraphDocument } from './project-session.js';

export interface BreadcrumbItem { readonly id:string; readonly label:string; readonly depth:number; }
export function activeGraphDefinition(state:StudioState):GraphDefinition|undefined{
  let graph=selectedGraphDocument(state)?.graph;if(!graph)return undefined;
  for(const groupId of state.graphSelection?.nodeGroupPath??[]){const group=state.project.nodeGroups[groupId];if(!group)return undefined;graph=group.internal_graph}
  return graph;
}
function groupTypeId(id:StableId):string{return `node-group:${id}`}
export function tryEnterNodeGroup(state:StudioState,groupId:StableId):EditResult{
  const group=state.project.nodeGroups[groupId];const active=activeGraphDefinition(state);
  if(!group||!active?.nodes.some(node=>node.typeId===groupTypeId(groupId)))return {state,diagnostics:[{severity:'Error',code:'MISSING_NODE_GROUP_REFERENCE',message:`Node Group ${groupId} is not available from the active graph.`,objectId:groupId}]};
  if(!state.graphSelection)return {state,diagnostics:[{severity:'Error',code:'NO_ACTIVE_GRAPH',message:'No graph selected.'}]};
  return {state:{...state,graphSelection:{...state.graphSelection,nodeGroupPath:[...state.graphSelection.nodeGroupPath,groupId]},selection:{kind:'none'}},diagnostics:[]};
}
export function enterNodeGroup(state:StudioState,groupId:StableId):StudioState{return tryEnterNodeGroup(state,groupId).state}
export function leaveNodeGroup(state:StudioState):StudioState{
  if(!state.graphSelection?.nodeGroupPath.length)return state;
  return {...state,graphSelection:{...state.graphSelection,nodeGroupPath:state.graphSelection.nodeGroupPath.slice(0,-1)},selection:{kind:'none'}};
}
export function navigateToBreadcrumb(state:StudioState,depth:number):StudioState{
  if(!state.graphSelection)return state;const clamped=Math.max(0,Math.min(depth,state.graphSelection.nodeGroupPath.length));
  return {...state,graphSelection:{...state.graphSelection,nodeGroupPath:state.graphSelection.nodeGroupPath.slice(0,clamped)},selection:{kind:'none'}};
}
export function buildBreadcrumbs(state:StudioState):readonly BreadcrumbItem[]{
  if(!state.graphSelection)return [];
  const items:BreadcrumbItem[]=[{id:state.graphSelection.graphId,label:state.graphSelection.stage,depth:0}];
  state.graphSelection.nodeGroupPath.forEach((id,index)=>items.push({id,label:state.project.nodeGroups[id]?.name??id,depth:index+1}));return items;
}

export function replaceActiveGraphDefinition(state:StudioState,graph:GraphDefinition):StudioState{
  if(!state.graphSelection)return state;
  const path=state.graphSelection.nodeGroupPath;
  if(!path.length){const stageDocuments=state.project.stageDocuments.map(document=>document.stage===state.graphSelection!.stage&&document.graph.id===state.graphSelection!.graphId?{...document,graph}:document);return {...state,project:{...state.project,stageDocuments},dirty:true}}
  const groupId=path.at(-1)!;const group=state.project.nodeGroups[groupId];if(!group)return state;
  return {...state,project:{...state.project,nodeGroups:{...state.project.nodeGroups,[groupId]:{...group,internal_graph:graph}}},dirty:true};
}
