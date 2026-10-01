import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRegistry,createRuntimeState,executeGraph } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { loadProject,toCompilerProject,registerPersistedNodeGroups } from '../../../dist/packages/project-model/src/index.js';
import { compileMeaningGraph } from '../../../dist/packages/compiler/src/index.js';
import { referenceSliceProject,registerReferenceSliceNodes } from '../../../dist/examples/reference-slice/project.js';
import { whoIsCookingFood } from '../../../dist/examples/reference-slice/meanings/who-is-cooking-food.js';

const reg=()=>{const r=new NodeRegistry();registerCorePrimitives(r);return r};
const opts={mode:'trace',maxStepsPerStage:100};
const graph=(typeId,params={})=>({id:'graph',nodes:[{id:'run',typeId,params}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'run',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'run',nodePortId:'value'}]});
const state=()=>createRuntimeState({roots:[],objects:{}});
const morph={id:'m',morphs:[
 {id:'a',kind:'Root',form:'e',features:{values:{}},sourceObjectId:'semantic-1'},
 {id:'z',kind:'Zero',featureId:'present',features:{values:{}},sourceObjectId:'semantic-1'},
 {id:'b',kind:'Affix',position:'Prefix',form:'si',boundaryBefore:"'",features:{values:{}}},
 {id:'c',kind:'Root',form:'cook',boundaryBefore:'',features:{values:{}}}
]};

test('structured phonology preserves explicit boundary tokens and zero-morph provenance',()=>{
 const phon=executeGraph(graph('phon.from-morphs'),reg(),{state:state()},{value:[morph]});
 assert.deepEqual(phon.diagnostics,[]);
 const value=phon.outputs.value[0];
 assert.equal(value.valueType,'PhonologicalForm');
 assert.ok(value.tokens.some(t=>t.kind==='Boundary'&&t.boundary==='Morpheme'));
 assert.ok(value.tokens.some(t=>t.kind==='Boundary'&&t.boundary==='Affix'));
 assert.deepEqual(value.zeroMorphIds,['z']);
 const spell=executeGraph(graph('surface.spell',{boundaries:{Morpheme:"'",Affix:''}}),reg(),{state:state()},{value:[value]});
 assert.deepEqual(spell.diagnostics,[]);
 assert.equal(spell.outputs.value[0].text,"e'sicook");
});

test('legacy three-stage projects remain executable without Phonology',()=>{
 const r=reg();registerReferenceSliceNodes(r);
 const output=compileMeaningGraph(referenceSliceProject,r,whoIsCookingFood,opts);
 assert.equal(output.success,true,JSON.stringify(output.diagnostics));
 assert.equal(output.surface,"person'vo duru esi'cook food");
 assert.equal(output.stageResults.Phonology,undefined);
});

test('persisted Phonology stage runs explicitly between Morphology and Surface',async()=>{
 const p=(await loadProject('examples/reference-language.vertax')).project;
 assert.ok(p);
 const c=toCompilerProject(p);
 assert.ok(c.project?.phonology);
 const r=reg();registerPersistedNodeGroups(r,p.nodeGroups);
 const testCase=p.tests['question-continuous'];
 const result=compileMeaningGraph(c.project,r,testCase.input,opts);
 assert.equal(result.success,true,JSON.stringify(result.diagnostics));
 assert.equal(result.surface,"person'vo duru esi'cook food");
 assert.deepEqual([...new Set(result.trace.map(step=>step.stage))],['Grammar','Morphology','Phonology','Surface']);
});
