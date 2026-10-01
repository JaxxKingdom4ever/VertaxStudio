import type { Diagnostic, StableId } from '../../core-types/src/index.js';
import type { PortDefinition } from '../../runtime/src/index.js';
import type { PortEndpoint, StudioState } from './model.js';
import { activeGraphDefinition } from './hierarchy.js';

export interface PortDescriptor {
  readonly nodeId: StableId;
  readonly portId: string;
  readonly direction: 'input' | 'output';
  readonly acceptedTypes: readonly string[];
  readonly cardinality: 'ONE' | 'OPTIONAL' | 'MANY';
  readonly required: boolean;
  readonly source: 'primitive' | 'node-group' | 'unknown';
}
function fromDef(nodeId:StableId,port:PortDefinition,source:PortDescriptor['source']):PortDescriptor{return {nodeId,portId:port.id,direction:port.direction,acceptedTypes:port.acceptedTypes,cardinality:port.cardinality,required:port.required,source}}
export function resolveNodePorts(state:StudioState,nodeId:StableId):readonly PortDescriptor[]{
  const node=activeGraphDefinition(state)?.nodes.find(n=>n.id===nodeId);if(!node)return [];
  const primitive=state.nodeDefinitions.find(def=>def.typeId===node.typeId);if(primitive)return [...primitive.inputs,...primitive.outputs].map(port=>fromDef(nodeId,port,'primitive'));
  if(node.typeId.startsWith('node-group:')){const id=node.typeId.slice('node-group:'.length);const group=state.project.nodeGroups[id];if(group)return [...group.inputs,...group.outputs].map(port=>fromDef(nodeId,port,'node-group'))}
  return [];
}
function error(code:string,message:string,nodeId?:string):Diagnostic{return {severity:'Error',code,message,nodeId}}
export function checkPortConnection(state:StudioState,source:PortEndpoint,target:PortEndpoint):readonly Diagnostic[]{
  const from=resolveNodePorts(state,source.nodeId).filter(port=>port.portId===source.portId);
  const to=resolveNodePorts(state,target.nodeId).filter(port=>port.portId===target.portId);
  // A node may legally name its input and output both 'value'. Prefer the
  // direction appropriate to this end of the connection before validating.
  const sourcePort=from.find(port=>port.direction==='output')??from[0];
  const targetPort=to.find(port=>port.direction==='input')??to[0];
  if(!sourcePort||!targetPort)return [error('UNKNOWN_PORT','Connection references an unknown port.',!sourcePort?source.nodeId:target.nodeId)];
  if(sourcePort.direction!=='output'||targetPort.direction!=='input')return [error('PORT_DIRECTION_MISMATCH','Connections must run from an output port to an input port.')];
  if(!sourcePort.acceptedTypes.some(type=>targetPort.acceptedTypes.includes(type)))return [error('PORT_TYPE_MISMATCH',`${sourcePort.acceptedTypes.join('|')} cannot connect to ${targetPort.acceptedTypes.join('|')}.`)];
  const graph=activeGraphDefinition(state);if(!graph)return [error('NO_ACTIVE_GRAPH','No active graph selected.')];
  if(graph.edges.some(edge=>edge.sourceNodeId===source.nodeId&&edge.sourcePortId===source.portId&&edge.targetNodeId===target.nodeId&&edge.targetPortId===target.portId))return [error('DUPLICATE_GRAPH_EDGE','That connection already exists.')];
  if(targetPort.cardinality!=='MANY'&&graph.edges.some(edge=>edge.targetNodeId===target.nodeId&&edge.targetPortId===target.portId))return [error('PORT_CARDINALITY_EXCEEDED',`${target.nodeId}.${target.portId} accepts only one incoming connection.`)];
  return [];
}
export function graphEdgeKey(edge:{sourceNodeId:string;sourcePortId:string;targetNodeId:string;targetPortId:string}):string{return `${edge.sourceNodeId}:${edge.sourcePortId}->${edge.targetNodeId}:${edge.targetPortId}`}
