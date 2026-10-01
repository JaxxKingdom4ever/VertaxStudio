import test from 'node:test';import assert from 'node:assert/strict';
import {loadProject,toCompilerProject,registerPersistedNodeGroups} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {compileMeaningGraph} from '../../../dist/packages/compiler/src/index.js';
import {buildSurfaceTraceSpans} from '../../../dist/packages/sentence-lab/src/index.js';
test('persisted phonology rule graph changes only phonetic output and keeps traceable source spans',async()=>{
 const raw=await loadProject('examples/reference-language.vertax');assert.ok(raw.project);
 const original=raw.project;
 const documents=original.stageDocuments.map(doc=>doc.stage==='Phonology'?{
  ...doc,graph:{...doc.graph,nodes:[...doc.graph.nodes,{id:'sound-change',typeId:'phon.replace',params:{target:'k',replaceWith:'g'}}],edges:[...doc.graph.edges,{sourceNodeId:'realize',sourcePortId:'value',targetNodeId:'sound-change',targetPortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'sound-change',nodePortId:'value'}]}
 }:doc);
 const modified={...original,stageDocuments:documents};
 const adapted=toCompilerProject(modified);assert.ok(adapted.project,JSON.stringify(adapted.diagnostics));
 const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,modified.nodeGroups);
 const graph=original.tests['question-continuous'].input;
 const originalResult=compileMeaningGraph(toCompilerProject(original).project,registry,graph,{mode:'trace',maxStepsPerStage:200});
 const changed=compileMeaningGraph(adapted.project,registry,graph,{mode:'trace',maxStepsPerStage:200});
 assert.equal(originalResult.surface,"person'vo duru esi'cook food");
 assert.equal(changed.surface,"person'vo duru esi'coog food");
 assert.equal(changed.success,true,JSON.stringify(changed.diagnostics));
 assert.ok(changed.trace.some(t=>t.stage==='Phonology'&&t.nodeIds.includes('sound-change')));
 const spans=buildSurfaceTraceSpans(changed);
 assert.equal(spans.map(span=>span.text).join(''),changed.surface);
 assert.ok(spans.some(span=>span.nodeIds.includes('realize')));
});
