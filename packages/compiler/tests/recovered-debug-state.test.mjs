import test from 'node:test';
import assert from 'node:assert/strict';
import { compileMeaningGraph, snapshotDebugState } from '../../../dist/packages/compiler/src/index.js';
import { createRuntimeState, openScope, openRequirement, NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { loadProject } from '../../../dist/packages/project-model/src/io.js';
import { toCompilerProject } from '../../../dist/packages/project-model/src/compiler-adapter.js';
import { registerPersistedNodeGroups } from '../../../dist/packages/project-model/src/node-group-runtime.js';
import { join } from 'node:path';
const meaning={roots:['e'],objects:{e:{id:'e',type:'Entity',conceptId:'sem:entity.person',roles:{},features:{values:{}}}}};

test('debug state preserves scope ancestry and requirement lifecycle as immutable independent snapshots',()=>{
 const initial=createRuntimeState(meaning);
 const scoped=openScope(initial,{id:'scope:child',type:'ComplementCall'});
 const withReq=openRequirement(scoped,{id:'req:child',creatorId:'node:caller',acceptedTypes:['Entity']});
 const snapshot=snapshotDebugState(withReq,[meaning.objects.e]);
 assert.equal(snapshot.currentScopeId,'scope:child');
 assert.equal(snapshot.scopes.find(x=>x.id==='scope:child').parentId,'scope:root');
 assert.equal(snapshot.requirements.find(x=>x.id==='req:child').status,'OPEN');
 assert.deepEqual(snapshot.values.map(x=>x.id),['e']);
 assert.equal(Object.isFrozen(snapshot),true);
 assert.equal(Object.isFrozen(snapshot.requirements[0]),true);
 assert.equal(Object.isFrozen(snapshot.values[0]),true);
 assert.throws(()=>{snapshot.values[0].features.values.new='break';},TypeError);
});

test('trace frames capture before and after state without changing fast compilation',async()=>{
 const loaded=await loadProject(join(process.cwd(),'examples','reference-language.vertax'));
 assert.ok(loaded.project,loaded.diagnostics.map(x=>x.message).join(';'));
 const adapted=toCompilerProject(loaded.project);assert.ok(adapted.project);
 const r=new NodeRegistry();registerCorePrimitives(r);registerPersistedNodeGroups(r,loaded.project.nodeGroups);
 const graph=Object.values(loaded.project.tests).find(t=>t.input_stage==='Meaning' && t.expected_output.surface==="person'vo duru esi'cook food")?.input;
 assert.ok(graph);
 const options={maxStepsPerStage:100};
 const fast=compileMeaningGraph(adapted.project,r,graph,{...options,mode:'fast'});
 const trace=compileMeaningGraph(adapted.project,r,graph,{...options,mode:'trace'});
 assert.deepEqual([trace.success,trace.surface,trace.diagnostics],[fast.success,fast.surface,fast.diagnostics]);
 assert.deepEqual(trace.debugFrames.length,trace.trace.length);
 assert.ok(trace.debugFrames.length>=3);
 for(const frame of trace.debugFrames){
   assert.equal(frame.beforeState.currentScopeId,'scope:root');
   assert.equal(frame.afterState.scopes[0].id,'scope:root');
   assert.deepEqual(frame.trace.nodeIds,trace.trace.find(x=>x.ruleId===frame.ruleId)?.nodeIds);
   assert.ok(Object.isFrozen(frame.afterState));
 }
 assert.deepEqual(fast.debugFrames,[]);
});
