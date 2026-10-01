import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudioState, moveNode, selectedGraphDocument, validateStudioState } from '../../../dist/packages/studio-model/src/index.js';
import { saveStudioProject } from '../../../dist/packages/studio-model/src/node-persistence.js';
import { saveProject, loadProject, toCompilerProject } from '../../../dist/packages/project-model/src/index.js';
import { compileMeaningGraph } from '../../../dist/packages/compiler/src/index.js';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { registerReferenceSliceNodes } from '../../../dist/examples/reference-slice/project.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';
import { whoIsCookingFood } from '../../../dist/examples/reference-slice/meanings/who-is-cooking-food.js';

function compile(project){const adapted=toCompilerProject(project);assert.deepEqual(adapted.diagnostics,[]);const registry=new NodeRegistry();registerCorePrimitives(registry);registerReferenceSliceNodes(registry);return compileMeaningGraph(adapted.project,registry,whoIsCookingFood,{mode:'trace',maxStepsPerStage:100})}

test('invalid editor graph reference blocks save and preserves existing disk project',async()=>{
  const parent=await mkdtemp(join(tmpdir(),'vertax-studio-invalid-'));const root=join(parent,'Reference.vertax');try{
    assert.equal((await saveProject(root,referencePersistedProject)).success,true);const graphPath=join(root,'graphs/grammar/ref-grammar-graph.json');const before=await readFile(graphPath,'utf8');
    const base=createStudioState(referencePersistedProject);const doc=selectedGraphDocument(base);const invalid={...base,project:{...base.project,stageDocuments:base.project.stageDocuments.map(d=>d===doc?{...d,graph:{...d.graph,edges:[...d.graph.edges,{sourceNodeId:d.graph.nodes[0].id,sourcePortId:'value',targetNodeId:'missing',targetPortId:'value'}]}}:d)},dirty:true};
    assert.equal(validateStudioState(invalid).some(d=>d.code==='MISSING_EDGE_NODE_REFERENCE'),true);const result=await saveStudioProject(invalid,root);assert.equal(result.success,false);assert.equal(await readFile(graphPath,'utf8'),before);
  } finally {await rm(parent,{recursive:true,force:true})}
});

test('layout-only Studio save reloads and preserves exact compiler output',async()=>{
  const parent=await mkdtemp(join(tmpdir(),'vertax-studio-save-'));const root=join(parent,'Reference.vertax');try{
    const base=createStudioState(referencePersistedProject);const id=selectedGraphDocument(base).graph.nodes[0].id;const moved=moveNode(base,id,777,333);const saved=await saveStudioProject(moved,root);assert.equal(saved.success,true);
    const loaded=await loadProject(root);assert.deepEqual(loaded.diagnostics,[]);assert.equal(loaded.project.layouts['ref-grammar-graph'].nodes[id].x,777);const result=compile(loaded.project);assert.equal(result.success,true);assert.equal(result.surface,"person'vo duru esi'cook food");
  } finally {await rm(parent,{recursive:true,force:true})}
});
