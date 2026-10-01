import type { StableId } from '../../core-types/src/index.js';
import type { GraphLayoutDocument, ViewportLayout } from '../../project-model/src/index.js';
import type { StudioState } from './model.js';
import { selectedGraphDocument, selectedGraphLayout } from './project-session.js';

function withLayout(state:StudioState, layout:GraphLayoutDocument):StudioState{
  return {...state,project:{...state.project,layouts:{...state.project.layouts,[layout.graph_id]:layout}},dirty:true};
}
export function selectNode(state:StudioState,nodeId:StableId):StudioState{return {...state,selection:{kind:'node',id:nodeId}}}
export function selectEdge(state:StudioState,edgeKey:string):StudioState{return {...state,selection:{kind:'edge',id:edgeKey}}}
export function moveNode(state:StudioState,nodeId:StableId,x:number,y:number):StudioState{
  const graph=selectedGraphDocument(state);if(!graph||!graph.graph.nodes.some(node=>node.id===nodeId))return state;
  const existing=selectedGraphLayout(state)??{schema_version:1 as const,graph_id:graph.graph.id,nodes:{}};
  return withLayout(state,{...existing,nodes:{...existing.nodes,[nodeId]:{...(existing.nodes[nodeId]??{}),x,y}}});
}
export function setViewport(state:StudioState,viewport:ViewportLayout):StudioState{
  const graph=selectedGraphDocument(state);if(!graph)return state;
  const existing=selectedGraphLayout(state)??{schema_version:1 as const,graph_id:graph.graph.id,nodes:{}};
  return withLayout(state,{...existing,viewport});
}
export function ensureNodeLayout(state:StudioState,nodeId:StableId):StudioState{
  const graph=selectedGraphDocument(state);if(!graph)return state;
  const index=graph.graph.nodes.findIndex(node=>node.id===nodeId);if(index<0)return state;
  const existing=selectedGraphLayout(state)??{schema_version:1 as const,graph_id:graph.graph.id,nodes:{}};
  if(existing.nodes[nodeId])return state;
  const cols=4;const x=(index%cols)*240;const y=Math.floor(index/cols)*150;
  return withLayout(state,{...existing,nodes:{...existing.nodes,[nodeId]:{x,y}}});
}

import type { GraphDefinition, GraphEdge } from '../../runtime/src/index.js';
import type { Diagnostic } from '../../core-types/src/index.js';
import type { EditResult, PortEndpoint } from './model.js';
import { checkPortConnection, graphEdgeKey, resolveNodePorts as resolveNodePortsImported } from './port-compatibility.js';
import { activeGraphDefinition, replaceActiveGraphDefinition } from './hierarchy.js';

export function connectPorts(state:StudioState,source:PortEndpoint,target:PortEndpoint):EditResult{
  const diagnostics=checkPortConnection(state,source,target);if(diagnostics.length)return {state,diagnostics};
  const graph=activeGraphDefinition(state);if(!graph)return {state,diagnostics:[{severity:'Error',code:'NO_ACTIVE_GRAPH',message:'No graph selected.'}]};
  const edge:GraphEdge={sourceNodeId:source.nodeId,sourcePortId:source.portId,targetNodeId:target.nodeId,targetPortId:target.portId};
  return {state:replaceActiveGraphDefinition(state,{...graph,edges:[...graph.edges,edge]}),diagnostics:[]};
}
export function disconnectEdge(state:StudioState,edgeKey:string):EditResult{
  const graph=activeGraphDefinition(state);if(!graph)return {state,diagnostics:[{severity:'Error',code:'NO_ACTIVE_GRAPH',message:'No graph selected.'}]};
  const edges=graph.edges.filter(edge=>graphEdgeKey(edge)!==edgeKey);if(edges.length===graph.edges.length)return {state,diagnostics:[{severity:'Error',code:'MISSING_GRAPH_EDGE',message:'Edge not found.'}]};
  return {state:replaceActiveGraphDefinition(state,{...graph,edges}),diagnostics:[]};
}

export type InspectorModel =
  | { readonly kind:'graph'; readonly graphId?:StableId; readonly nodeCount:number; readonly edgeCount:number }
  | { readonly kind:'node'; readonly nodeId:StableId; readonly typeId:string; readonly params:Readonly<Record<string,unknown>>; readonly ports:readonly import('./port-compatibility.js').PortDescriptor[] }
  | { readonly kind:'edge'; readonly edgeKey:string; readonly source:string; readonly target:string };

export function updateNodeParams(state:StudioState,nodeId:StableId,params:Readonly<Record<string,unknown>>):EditResult{
  const graph=activeGraphDefinition(state);if(!graph)return {state,diagnostics:[{severity:'Error',code:'NO_ACTIVE_GRAPH',message:'No graph selected.'}]};
  if(!graph.nodes.some(node=>node.id===nodeId))return {state,diagnostics:[{severity:'Error',code:'MISSING_GRAPH_NODE',message:`Node ${nodeId} was not found.`}]};
  const nodes=graph.nodes.map(node=>node.id===nodeId?{...node,params}:node);
  return {state:replaceActiveGraphDefinition(state,{...graph,nodes}),diagnostics:[]};
}
export function removeNode(state:StudioState,nodeId:StableId):EditResult{
  const current=activeGraphDefinition(state);if(!current)return {state,diagnostics:[{severity:'Error',code:'NO_ACTIVE_GRAPH',message:'No graph selected.'}]};
  if(!current.nodes.some(node=>node.id===nodeId))return {state,diagnostics:[{severity:'Error',code:'MISSING_GRAPH_NODE',message:`Node ${nodeId} was not found.`}]};
  const graph={...current,nodes:current.nodes.filter(node=>node.id!==nodeId),edges:current.edges.filter(edge=>edge.sourceNodeId!==nodeId&&edge.targetNodeId!==nodeId),exposedInputs:current.exposedInputs.filter(binding=>binding.nodeId!==nodeId),exposedOutputs:current.exposedOutputs.filter(binding=>binding.nodeId!==nodeId)};
  let next=replaceActiveGraphDefinition(state,graph);const layout=(state.graphSelection?.nodeGroupPath.length??0)===0?selectedGraphLayout(next):undefined;if(layout){const {[nodeId]:_removed,...nodes}=layout.nodes;next={...next,project:{...next.project,layouts:{...next.project.layouts,[layout.graph_id]:{...layout,nodes}}}}}
  return {state:{...next,selection:{kind:'none'}},diagnostics:[]};
}
export function removeSelected(state:StudioState):EditResult{
  if(state.selection.kind==='node'&&state.selection.id)return removeNode(state,state.selection.id);
  if(state.selection.kind==='edge'&&state.selection.id){const result=disconnectEdge(state,state.selection.id);return result.diagnostics.length?result:{state:{...result.state,selection:{kind:'none'}},diagnostics:[]}}
  return {state,diagnostics:[]};
}
export function selectedInspectorModel(state:StudioState):InspectorModel{
  const graph=activeGraphDefinition(state);
  if(state.selection.kind==='node'&&state.selection.id&&graph){const node=graph.nodes.find(item=>item.id===state.selection.id);if(node)return {kind:'node',nodeId:node.id,typeId:node.typeId,params:node.params,ports:resolveNodePortsForInspector(state,node.id)}}
  if(state.selection.kind==='edge'&&state.selection.id&&graph){const edge=graph.edges.find(item=>graphEdgeKey(item)===state.selection.id);if(edge)return {kind:'edge',edgeKey:state.selection.id,source:`${edge.sourceNodeId}.${edge.sourcePortId}`,target:`${edge.targetNodeId}.${edge.targetPortId}`}}
  return {kind:'graph',graphId:graph?.id,nodeCount:graph?.nodes.length??0,edgeCount:graph?.edges.length??0};
}
function resolveNodePortsForInspector(state:StudioState,nodeId:StableId){return resolveNodePortsImported(state,nodeId)}
