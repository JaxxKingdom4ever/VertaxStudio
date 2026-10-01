import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioState, moveNode, selectNode, selectEdge, setViewport, ensureNodeLayout, selectedGraphDocument, selectedGraphLayout } from '../../../dist/packages/studio-model/src/index.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';

test('moving a node mutates layout only and marks project dirty', () => {
  const state=createStudioState(referencePersistedProject);
  const graphBefore=structuredClone(selectedGraphDocument(state));
  const canonicalBefore=JSON.stringify(graphBefore);
  const nodeId=graphBefore.graph.nodes[0].id;
  const next=moveNode(state,nodeId,444,222);
  assert.equal(selectedGraphLayout(next).nodes[nodeId].x,444);
  assert.equal(selectedGraphLayout(next).nodes[nodeId].y,222);
  assert.deepEqual(selectedGraphDocument(next),graphBefore);
  assert.equal(JSON.stringify(selectedGraphDocument(next)),canonicalBefore);
  assert.equal(next.dirty,true);
});

test('selection edits do not mark project dirty', () => {
  const state=createStudioState(referencePersistedProject);
  const node=state.project.stageDocuments.find(d=>d.stage==='Grammar').graph.nodes[0];
  assert.equal(selectNode(state,node.id).dirty,false);
  assert.equal(selectEdge(state,'edge-key').dirty,false);
});

test('viewport and missing layout initialization are layout-only', () => {
  const base=createStudioState(referencePersistedProject);
  const nodeId=selectedGraphDocument(base).graph.nodes[0].id;
  const project={...base.project,layouts:{...base.project.layouts,[selectedGraphDocument(base).graph.id]:{schema_version:1,graph_id:selectedGraphDocument(base).graph.id,nodes:{}}}};
  const state={...base,project};
  const ensured=ensureNodeLayout(state,nodeId);
  assert.deepEqual(ensured.project.layouts[selectedGraphDocument(base).graph.id].nodes[nodeId],{x:0,y:0});
  const viewed=setViewport(ensured,{x:20,y:30,zoom:1.25});
  assert.deepEqual(selectedGraphLayout(viewed).viewport,{x:20,y:30,zoom:1.25});
  assert.deepEqual(selectedGraphDocument(viewed),selectedGraphDocument(base));
});

import { updateNodeParams, removeNode, removeSelected, selectedInspectorModel, connectPorts } from '../../../dist/packages/studio-model/src/index.js';

test('updating node params changes only selected node params',()=>{
  const state=createStudioState(referencePersistedProject);
  const node=selectedGraphDocument(state).graph.nodes[0];
  const before=selectedGraphDocument(state).graph.nodes;
  const result=updateNodeParams(state,node.id,{alpha:1,label:'x'});
  assert.deepEqual(result.diagnostics,[]);
  const after=selectedGraphDocument(result.state).graph.nodes;
  assert.deepEqual(after.find(n=>n.id===node.id).params,{alpha:1,label:'x'});
  assert.deepEqual(after.filter(n=>n.id!==node.id),before.filter(n=>n.id!==node.id));
});

test('removing node removes incident edges and layout atomically',()=>{
  const grammar=referencePersistedProject.stageDocuments.find(d=>d.stage==='Grammar');
  const graph={...grammar.graph,nodes:[...grammar.graph.nodes,{id:'extra',typeId:grammar.graph.nodes[0].typeId,params:{}}],edges:[{sourceNodeId:grammar.graph.nodes[0].id,sourcePortId:'value',targetNodeId:'extra',targetPortId:'value'}]};
  const project={...referencePersistedProject,stageDocuments:[{...grammar,graph},...referencePersistedProject.stageDocuments.filter(d=>d!==grammar)],layouts:{...referencePersistedProject.layouts,[grammar.graph.id]:{...referencePersistedProject.layouts[grammar.graph.id],nodes:{...referencePersistedProject.layouts[grammar.graph.id].nodes,extra:{x:300,y:100}}}}};
  const state=createStudioState(project);
  const result=removeNode(state,'extra');
  assert.deepEqual(result.diagnostics,[]);
  assert.equal(selectedGraphDocument(result.state).graph.nodes.some(n=>n.id==='extra'),false);
  assert.equal(selectedGraphDocument(result.state).graph.edges.length,0);
  assert.equal(selectedGraphLayout(result.state).nodes.extra,undefined);
});

test('removing selected edge preserves endpoint nodes and layout',()=>{
  const grammar=referencePersistedProject.stageDocuments.find(d=>d.stage==='Grammar');
  const graph={...grammar.graph,nodes:[...grammar.graph.nodes,{id:'extra',typeId:grammar.graph.nodes[0].typeId,params:{}}],edges:[{sourceNodeId:grammar.graph.nodes[0].id,sourcePortId:'value',targetNodeId:'extra',targetPortId:'value'}]};
  const project={...referencePersistedProject,stageDocuments:[{...grammar,graph},...referencePersistedProject.stageDocuments.filter(d=>d!==grammar)],layouts:{...referencePersistedProject.layouts,[grammar.graph.id]:{...referencePersistedProject.layouts[grammar.graph.id],nodes:{...referencePersistedProject.layouts[grammar.graph.id].nodes,extra:{x:300,y:100}}}}};
  const state={...createStudioState(project),selection:{kind:'edge',id:`${grammar.graph.nodes[0].id}:value->extra:value`}};
  const result=removeSelected(state);
  assert.equal(selectedGraphDocument(result.state).graph.edges.length,0);
  assert.equal(selectedGraphDocument(result.state).graph.nodes.length,2);
  assert.ok(selectedGraphLayout(result.state).nodes.extra);
});

test('inspector model clears stale details when nothing selected',()=>{
  const state=createStudioState(referencePersistedProject);
  const model=selectedInspectorModel(state);
  assert.equal(model.kind,'graph');
  assert.equal(model.graphId,'ref-grammar-graph');
});
