import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveProject, loadProject, validateProject, toCompilerProject } from '../../../dist/packages/project-model/src/index.js';
import { compileMeaningGraph } from '../../../dist/packages/compiler/src/index.js';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { registerReferenceSliceNodes } from '../../../dist/examples/reference-slice/project.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';
import { whoIsCookingFood } from '../../../dist/examples/reference-slice/meanings/who-is-cooking-food.js';

function compile(project){
  const adapted=toCompilerProject(project);
  assert.deepEqual(adapted.diagnostics,[]);
  const registry=new NodeRegistry();
  registerCorePrimitives(registry); registerReferenceSliceNodes(registry);
  return compileMeaningGraph(adapted.project,registry,whoIsCookingFood,{mode:'trace',maxStepsPerStage:100});
}

test('reference project survives disk round trip and still compiles exact surface', async () => {
  const parent=await mkdtemp(join(tmpdir(),'vertax-roundtrip-'));
  const root=join(parent,'Reference.vertax');
  try{
    const saved=await saveProject(root,referencePersistedProject);
    assert.equal(saved.success,true);
    const loaded=await loadProject(root);
    assert.deepEqual(loaded.diagnostics,[]);
    assert.ok(loaded.project);
    assert.deepEqual(loaded.project.stageDocuments,referencePersistedProject.stageDocuments);
    assert.deepEqual(validateProject(loaded.project),[]);
    const result=compile(loaded.project);
    assert.equal(result.success,true);
    assert.equal(result.surface,"person'vo duru esi'cook food");
  } finally { await rm(parent,{recursive:true,force:true}); }
});

test('moving saved layout coordinates cannot change compiler output', () => {
  const before=compile(referencePersistedProject);
  const moved={...referencePersistedProject,layouts:Object.fromEntries(Object.entries(referencePersistedProject.layouts).map(([id,l])=>[id,{...l,nodes:Object.fromEntries(Object.keys(l.nodes).map(nodeId=>[nodeId,{x:999,y:-222}]))}]))};
  const after=compile(moved);
  assert.equal(before.surface,"person'vo duru esi'cook food");
  assert.equal(after.surface,before.surface);
  assert.deepEqual(moved.stageDocuments,referencePersistedProject.stageDocuments);
});
