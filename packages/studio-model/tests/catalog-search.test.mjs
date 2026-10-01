import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { createStudioState, buildNodeCatalog, searchNodeCatalog, nodeGroupTypeId, parseNodeGroupTypeId, addCatalogNode, selectedGraphDocument, selectedGraphLayout } from '../../../dist/packages/studio-model/src/index.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';

const group={schema_version:1,id:'recursive-possession',name:'Recursive Possession',version:'1.0.0',description:'Resolve a possessor trail',inputs:[{id:'value',direction:'input',acceptedTypes:['Entity'],cardinality:'ONE',required:true}],outputs:[{id:'value',direction:'output',acceptedTypes:['GrammarStructure'],cardinality:'ONE',required:true}],parameters:[],internal_graph:{id:'recursive-possession-internal',nodes:[],edges:[],exposedInputs:[],exposedOutputs:[]},test_ids:[]};
function state(){const registry=new NodeRegistry();registerCorePrimitives(registry);const project={...referencePersistedProject,nodeGroups:{...referencePersistedProject.nodeGroups,[group.id]:group}};return createStudioState(project,registry.listDefinitions())}

test('catalog includes registered primitives and custom Node Groups',()=>{
  const entries=buildNodeCatalog(state());
  assert.ok(entries.some(entry=>entry.typeId==='surface.join'&&entry.source==='primitive'));
  const custom=entries.find(entry=>entry.groupId===group.id);
  assert.equal(custom?.label,'Recursive Possession');
  assert.equal(custom?.typeId,'node-group:recursive-possession');
});

test('Node Group type id convention round-trips exactly',()=>{
  assert.equal(nodeGroupTypeId('abc'),'node-group:abc');
  assert.equal(parseNodeGroupTypeId('node-group:abc'),'abc');
  assert.equal(parseNodeGroupTypeId('surface.join'),undefined);
});

test('search ranks exact and prefix matches ahead of unrelated entries',()=>{
  const entries=buildNodeCatalog(state());
  const join=searchNodeCatalog(entries,'join');
  assert.equal(join[0]?.typeId,'surface.join');
  const groups=searchNodeCatalog(entries,'group:recursive');
  assert.equal(groups[0]?.groupId,'recursive-possession');
});

test('adding a catalog node creates stable graph node id and requested layout',()=>{
  const start=state();const entry=buildNodeCatalog(start).find(e=>e.typeId==='surface.join');
  const result=addCatalogNode(start,entry,{x:321,y:654});
  assert.deepEqual(result.diagnostics,[]);
  const added=selectedGraphDocument(result.state).graph.nodes.at(-1);
  assert.ok(added.id.startsWith('studio-node-'));
  assert.equal(added.typeId,'surface.join');
  assert.deepEqual(selectedGraphLayout(result.state).nodes[added.id],{x:321,y:654});
});

test('custom Node Group inserts without runtime registration',()=>{
  const start=state();const entry=buildNodeCatalog(start).find(e=>e.groupId===group.id);
  const result=addCatalogNode(start,entry,{x:12,y:34});
  const added=selectedGraphDocument(result.state).graph.nodes.at(-1);
  assert.equal(added.typeId,'node-group:recursive-possession');
});
