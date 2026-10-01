import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, saveProject } from '../../../dist/packages/project-model/src/index.js';
import { registerPersistedNodeGroups } from '../../../dist/packages/project-model/src/index.js';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { runPersistedPackTests } from '../../../dist/packages/translation/src/index.js';
import { createEmptyMeaningGraph,addSemanticObject,setSemanticRoots,setSemanticRole,removeSemanticObject,buildMeaningTree,createSentenceLabState,compileSentenceLab,buildTraceRows,findFirstBreakpointHit,buildScopeTree,openRequirements,buildGlossUnits,buildStructureSections,buildSurfaceTraceSpans,saveSentenceLabTest,inspectTraceValue } from '../../../dist/packages/sentence-lab/src/index.js';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ent=(id,conceptId)=>({id,type:'Entity',conceptId,roles:{},features:{values:{}}});
const event=id=>({id,type:'Event',conceptId:'sem:event.cook',roles:{},features:{values:{}}});

test('immutable composer edits clean dangling references and cycle-safe tree preserves semantic identity',()=>{
 let graph=createEmptyMeaningGraph();
 graph=addSemanticObject(graph,ent('shared','sem:entity.food')).graph;
 graph=addSemanticObject(graph,event('a')).graph;
 graph=addSemanticObject(graph,event('b')).graph;
 graph=setSemanticRole(graph,'a','theme',['shared','b']).graph;
 graph=setSemanticRole(graph,'b','theme',['shared','a']).graph;
 graph=setSemanticRoots(graph,['a','b']).graph;
 const tree=buildMeaningTree(graph);
 assert.equal(tree.length,2);
 assert.equal(tree[0].children.some(x=>x.cyclic || x.children.some(y=>y.cyclic)),true);
 assert.equal(tree[1].repeated,true);
 const old=structuredClone(graph);
 graph=removeSemanticObject(graph,'shared').graph;
 assert.deepEqual(old.objects.a.roles.theme,['shared','b']);
 assert.deepEqual(graph.objects.a.roles.theme,['b']);
 assert.deepEqual(graph.objects.b.roles.theme,['a']);
 assert.equal(graph.objects.shared,undefined);
 assert.equal(setSemanticRole(graph,'b','agent',['MISSING']).diagnostics[0].code,'MISSING_SEMANTIC_REFERENCE');
 assert.equal(addSemanticObject(graph,event('a')).diagnostics[0].code,'DUPLICATE_SEMANTIC_OBJECT');
 assert.equal(setSemanticRoots(graph,['MISSING']).diagnostics[0].code,'MISSING_SEMANTIC_ROOT');
});

const load=async()=>{
 const result=await loadProject('examples/reference-language.vertax');
 assert.ok(result.project,JSON.stringify(result.diagnostics));
 return result.project;
};
test('Sentence Lab compiles only confirmed graph and supports breakpoint timeline with scope snapshots',async()=>{
 const project=await load();
 const input=project.tests['question-continuous'].input;
 const state={...createSentenceLabState(input),sourceText:'THIS IS DELIBERATELY NOT THE MEANING'};
 const compiled=compileSentenceLab(project,[],state);
 assert.equal(compiled.result?.success,true);
 assert.equal(compiled.result?.surface,"person'vo duru esi'cook food");
 assert.equal(compiled.sourceText,state.sourceText);
 assert.ok(compiled.result.debugFrames.length>=4);
 assert.ok(buildTraceRows(compiled.result.debugFrames,[]).length>=4);
 const nodeId=compiled.result.trace[1].nodeIds[0];
 const withBreakpoint=compileSentenceLab(project,[],{...state,breakpoints:[nodeId]});
 assert.equal(withBreakpoint.traceCursor,findFirstBreakpointHit(withBreakpoint.result.debugFrames,[nodeId]));
 assert.equal(findFirstBreakpointHit(compiled.result.debugFrames,['not-real']),undefined);
 const frame=compiled.result.debugFrames[0];
 assert.ok(buildScopeTree(frame,'after').some(x=>x.current));
 assert.deepEqual(openRequirements(frame,'before'),[]);
 assert.ok(inspectTraceValue(frame,'before',frame.before[0].id));
 assert.ok(buildStructureSections(compiled.result).some(x=>x.stage==='Phonology'));
 assert.ok(buildGlossUnits(compiled.result).length>0);
 const spans=buildSurfaceTraceSpans(compiled.result);
 assert.equal(spans.map(x=>x.text).join(''),compiled.result.surface);
 assert.deepEqual(compiled.meaningGraph,input);
 const fast=compileSentenceLab(project,[],{...state,compileMode:'fast'});
 assert.equal(fast.result?.surface,compiled.result.surface);
 assert.deepEqual(fast.result?.debugFrames,[]);
});

test('saved Sentence Lab test round-trips into a .vertax project and executes after reload',async()=>{
 const project=await load();
 const state=compileSentenceLab(project,[],createSentenceLabState(project.tests['question-continuous'].input));
 const saved=saveSentenceLabTest(project,state,{id:'saved-from-lab',name:'Lab reference question'});
 assert.deepEqual(saved.diagnostics,[]);
 assert.equal(saved.project.tests['saved-from-lab'].expected_output.surface,state.result.surface);
 assert.equal(project.tests['saved-from-lab'],undefined);
 const directory=await mkdtemp(join(tmpdir(),'vertax-sentence-lab-'));
 try{
   const written=await saveProject(join(directory,'saved.vertax'),saved.project);
   assert.equal(written.success,true);
   const reload=await loadProject(join(directory,'saved.vertax'));
   assert.ok(reload.project,JSON.stringify(reload.diagnostics));
   const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,reload.project.nodeGroups);
   const report=runPersistedPackTests(reload.project,registry,{mode:'fast',maxStepsPerStage:100});
   assert.equal(report.failures.length,0,JSON.stringify(report.failures));
 }finally{await rm(directory,{recursive:true,force:true});}
});
