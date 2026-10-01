import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioState, createStudioHistory, applyStudioEdit, undoStudio, redoStudio, moveNode, selectNode, selectedGraphDocument, selectedGraphLayout, connectPorts } from '../../../dist/packages/studio-model/src/index.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';

function edit(fn){return state=>({state:fn(state),diagnostics:[]})}

test('move node then undo restores exact prior layout',()=>{
  const state=createStudioState(referencePersistedProject);const id=selectedGraphDocument(state).graph.nodes[0].id;const before=structuredClone(selectedGraphLayout(state));
  const moved=applyStudioEdit(createStudioHistory(state),edit(s=>moveNode(s,id,900,500)));
  assert.equal(selectedGraphLayout(moved.present).nodes[id].x,900);
  const undone=undoStudio(moved);assert.deepEqual(selectedGraphLayout(undone.present),before);
});

test('structural edit undo and redo restores same project graph',()=>{
  const grammar=referencePersistedProject.stageDocuments.find(d=>d.stage==='Grammar');
  const doc={...grammar,graph:{id:'history-graph',nodes:[{id:'a',typeId:'x',params:{}},{id:'b',typeId:'x',params:{}}],edges:[],exposedInputs:[],exposedOutputs:[]}};
  const project={...referencePersistedProject,stageDocuments:[doc,...referencePersistedProject.stageDocuments.filter(d=>d.stage!=='Grammar')],layouts:{...referencePersistedProject.layouts,'history-graph':{schema_version:1,graph_id:'history-graph',nodes:{a:{x:0,y:0},b:{x:200,y:0}}}}};
  const def={typeId:'x',inputs:[{id:'in',direction:'input',acceptedTypes:['Entity'],cardinality:'ONE',required:false}],outputs:[{id:'out',direction:'output',acceptedTypes:['Entity'],cardinality:'ONE',required:false}],evaluate:()=>({outputs:{},diagnostics:[]})};
  const state=createStudioState(project,[def]);
  let h=createStudioHistory(state);h=applyStudioEdit(h,s=>connectPorts(s,{nodeId:'a',portId:'out'},{nodeId:'b',portId:'in'}));
  assert.equal(selectedGraphDocument(h.present).graph.edges.length,1);h=undoStudio(h);assert.equal(selectedGraphDocument(h.present).graph.edges.length,0);h=redoStudio(h);assert.equal(selectedGraphDocument(h.present).graph.edges.length,1);
});

test('selection-only edit does not create history entry',()=>{
  const state=createStudioState(referencePersistedProject);const id=selectedGraphDocument(state).graph.nodes[0].id;
  const h=applyStudioEdit(createStudioHistory(state),edit(s=>selectNode(s,id)));
  assert.equal(h.past.length,0);
});

test('new edit after undo clears redo history',()=>{
  const state=createStudioState(referencePersistedProject);const id=selectedGraphDocument(state).graph.nodes[0].id;
  let h=applyStudioEdit(createStudioHistory(state),edit(s=>moveNode(s,id,1,2)));h=undoStudio(h);assert.equal(h.future.length,1);h=applyStudioEdit(h,edit(s=>moveNode(s,id,3,4)));assert.equal(h.future.length,0);
});
