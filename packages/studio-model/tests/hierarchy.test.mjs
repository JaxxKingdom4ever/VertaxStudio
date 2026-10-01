import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioState, enterNodeGroup, tryEnterNodeGroup, leaveNodeGroup, navigateToBreadcrumb, buildBreadcrumbs, activeGraphDefinition, connectPorts } from '../../../dist/packages/studio-model/src/index.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';

const g2={schema_version:1,id:'g2',name:'Inner Group',version:'1.0.0',inputs:[],outputs:[],parameters:[],internal_graph:{id:'g2-internal',nodes:[],edges:[],exposedInputs:[],exposedOutputs:[]},test_ids:[]};
const g1={schema_version:1,id:'g1',name:'Outer Group',version:'1.0.0',inputs:[],outputs:[],parameters:[],internal_graph:{id:'g1-internal',nodes:[{id:'inner-node',typeId:'node-group:g2',params:{}}],edges:[],exposedInputs:[],exposedOutputs:[]},test_ids:[]};
function state(){const grammar=referencePersistedProject.stageDocuments.find(d=>d.stage==='Grammar');const graph={...grammar.graph,nodes:[...grammar.graph.nodes,{id:'outer-node',typeId:'node-group:g1',params:{}}]};const project={...referencePersistedProject,stageDocuments:[{...grammar,graph},...referencePersistedProject.stageDocuments.filter(d=>d!==grammar)],nodeGroups:{g1,g2}};return createStudioState(project)}

test('entering Node Group appends path and exposes internal graph without mutating parent',()=>{
  const start=state();const parent=structuredClone(activeGraphDefinition(start));
  const entered=enterNodeGroup(start,'g1');
  assert.deepEqual(entered.graphSelection.nodeGroupPath,['g1']);
  assert.equal(activeGraphDefinition(entered).id,'g1-internal');
  assert.deepEqual(activeGraphDefinition(start),parent);
  const inner=enterNodeGroup(entered,'g2');
  assert.equal(activeGraphDefinition(inner).id,'g2-internal');
  assert.deepEqual(inner.graphSelection.nodeGroupPath,['g1','g2']);
});

test('breadcrumb navigation restores exact parent graph selection',()=>{
  const deep=enterNodeGroup(enterNodeGroup(state(),'g1'),'g2');
  const crumbs=buildBreadcrumbs(deep);
  assert.deepEqual(crumbs.map(c=>c.label),['Grammar','Outer Group','Inner Group']);
  const parent=navigateToBreadcrumb(deep,1);
  assert.deepEqual(parent.graphSelection.nodeGroupPath,['g1']);
  assert.equal(activeGraphDefinition(parent).id,'g1-internal');
  const root=leaveNodeGroup(parent);
  assert.deepEqual(root.graphSelection.nodeGroupPath,[]);
  assert.equal(activeGraphDefinition(root).id,'ref-grammar-graph');
});

test('invalid Node Group reference leaves state unchanged with diagnostic',()=>{
  const start=state();const result=tryEnterNodeGroup(start,'missing');
  assert.equal(result.state,start);
  assert.equal(result.diagnostics[0]?.code,'MISSING_NODE_GROUP_REFERENCE');
});

test('structural edits inside a Node Group mutate the group graph, not the parent graph',()=>{
  const def={typeId:'x',inputs:[{id:'in',direction:'input',acceptedTypes:['Entity'],cardinality:'ONE',required:false}],outputs:[{id:'out',direction:'output',acceptedTypes:['Entity'],cardinality:'ONE',required:false}],evaluate:()=>({outputs:{},diagnostics:[]})};
  const grammar=referencePersistedProject.stageDocuments.find(d=>d.stage==='Grammar');
  const group={schema_version:1,id:'editable',name:'Editable',version:'1',inputs:[],outputs:[],parameters:[],internal_graph:{id:'editable-internal',nodes:[{id:'a',typeId:'x',params:{}},{id:'b',typeId:'x',params:{}}],edges:[],exposedInputs:[],exposedOutputs:[]},test_ids:[]};
  const parentGraph={...grammar.graph,nodes:[...grammar.graph.nodes,{id:'group-node',typeId:'node-group:editable',params:{}}]};
  const project={...referencePersistedProject,stageDocuments:[{...grammar,graph:parentGraph},...referencePersistedProject.stageDocuments.filter(d=>d!==grammar)],nodeGroups:{editable:group}};
  const entered=enterNodeGroup(createStudioState(project,[def]),'editable');
  const result=connectPorts(entered,{nodeId:'a',portId:'out'},{nodeId:'b',portId:'in'});
  assert.deepEqual(result.diagnostics,[]);
  assert.equal(result.state.project.nodeGroups.editable.internal_graph.edges.length,1);
  assert.equal(result.state.project.stageDocuments.find(d=>d.stage==='Grammar').graph.edges.length,parentGraph.edges.length);
});
