import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { createStudioState, checkPortConnection, connectPorts, disconnectEdge } from '../../../dist/packages/studio-model/src/index.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';

const noop=()=>({outputs:{},diagnostics:[]});
const source={typeId:'test.entity-source',inputs:[],outputs:[{id:'out',direction:'output',acceptedTypes:['Entity'],cardinality:'ONE',required:true}],evaluate:noop};
const entityTarget={typeId:'test.entity-target',inputs:[{id:'in',direction:'input',acceptedTypes:['Entity'],cardinality:'ONE',required:true}],outputs:[],evaluate:noop};
const morphTarget={typeId:'test.morph-target',inputs:[{id:'in',direction:'input',acceptedTypes:['Morph'],cardinality:'ONE',required:true}],outputs:[],evaluate:noop};

function projectWithNodes(){
  const doc={schema_version:1,stage:'Grammar',graph:{id:'ports-graph',nodes:[{id:'a',typeId:source.typeId,params:{}},{id:'b',typeId:entityTarget.typeId,params:{}},{id:'c',typeId:morphTarget.typeId,params:{}}],edges:[],exposedInputs:[],exposedOutputs:[]},rules:[]};
  return {...referencePersistedProject,stageDocuments:[doc,...referencePersistedProject.stageDocuments.filter(d=>d.stage!=='Grammar')],layouts:{...referencePersistedProject.layouts,'ports-graph':{schema_version:1,graph_id:'ports-graph',nodes:{a:{x:0,y:0},b:{x:300,y:0},c:{x:300,y:150}}}}};
}
function state(){const registry=new NodeRegistry();registry.register(source);registry.register(entityTarget);registry.register(morphTarget);return createStudioState(projectWithNodes(),registry.listDefinitions())}

test('NodeRegistry enumerates registered definitions without mutation access',()=>{
  const registry=new NodeRegistry();registry.register(source);registry.register(entityTarget);
  const defs=registry.listDefinitions();
  assert.deepEqual(defs.map(d=>d.typeId),[source.typeId,entityTarget.typeId]);
  assert.notEqual(defs,registry.listDefinitions());
});

test('compatible output to input connects and can disconnect',()=>{
  const start=state();const sourcePort={nodeId:'a',portId:'out'},targetPort={nodeId:'b',portId:'in'};
  assert.deepEqual(checkPortConnection(start,sourcePort,targetPort),[]);
  const connected=connectPorts(start,sourcePort,targetPort);
  assert.deepEqual(connected.diagnostics,[]);assert.equal(connected.state.project.stageDocuments[0].graph.edges.length,1);
  const key='a:out->b:in';const removed=disconnectEdge(connected.state,key);
  assert.deepEqual(removed.diagnostics,[]);assert.equal(removed.state.project.stageDocuments[0].graph.edges.length,0);
});

test('direction mismatch is rejected without graph mutation',()=>{
  const start=state();const before=JSON.stringify(start.project.stageDocuments[0].graph);
  const result=connectPorts(start,{nodeId:'b',portId:'in'},{nodeId:'c',portId:'in'});
  assert.equal(result.diagnostics[0]?.code,'PORT_DIRECTION_MISMATCH');assert.equal(JSON.stringify(result.state.project.stageDocuments[0].graph),before);
});

test('type mismatch is rejected without graph mutation',()=>{
  const start=state();const before=JSON.stringify(start.project.stageDocuments[0].graph);
  const result=connectPorts(start,{nodeId:'a',portId:'out'},{nodeId:'c',portId:'in'});
  assert.equal(result.diagnostics[0]?.code,'PORT_TYPE_MISMATCH');assert.equal(JSON.stringify(result.state.project.stageDocuments[0].graph),before);
});

test('ONE input rejects a second incoming edge',()=>{
  let start=state();const doc=start.project.stageDocuments[0];
  const graph={...doc.graph,nodes:[...doc.graph.nodes,{id:'a2',typeId:source.typeId,params:{}}]};
  start={...start,project:{...start.project,stageDocuments:[{...doc,graph},...start.project.stageDocuments.slice(1)]}};
  const one=connectPorts(start,{nodeId:'a',portId:'out'},{nodeId:'b',portId:'in'}).state;
  const result=connectPorts(one,{nodeId:'a2',portId:'out'},{nodeId:'b',portId:'in'});
  assert.equal(result.diagnostics[0]?.code,'PORT_CARDINALITY_EXCEEDED');assert.equal(result.state.project.stageDocuments[0].graph.edges.length,1);
});

test('exact duplicate edge is rejected',()=>{
  const start=state();const one=connectPorts(start,{nodeId:'a',portId:'out'},{nodeId:'b',portId:'in'}).state;
  const result=connectPorts(one,{nodeId:'a',portId:'out'},{nodeId:'b',portId:'in'});
  assert.equal(result.diagnostics[0]?.code,'DUPLICATE_GRAPH_EDGE');assert.equal(result.state.project.stageDocuments[0].graph.edges.length,1);
});
