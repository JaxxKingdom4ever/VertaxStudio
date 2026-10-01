import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,toCompilerProject,toAnalyzerProject} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {translateSurface} from '../../../dist/packages/translation/src/index.js';
const opts={mode:'fast',maxStepsPerStage:80};
const reg=new NodeRegistry();registerCorePrimitives(reg);
let loaded;
async function args(text){loaded??=(await loadProject('language-packs/english.vertax')).project;return {sourceProject:toAnalyzerProject(loaded).project,targetProject:toCompilerProject(loaded).project,sourceRegistry:reg,targetRegistry:reg,sourceLoaded:loaded,targetLoaded:loaded,text,options:opts};}
test('English-to-English goes through MeaningGraph rather than string substitution',async()=>{
 const result=translateSurface(await args('The person cooks the food.'));
 assert.equal(result.success,true,JSON.stringify(result.diagnostics));assert.equal(result.surface,'The person cooks the food.');
 assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].meaning.objects.event.conceptId,'sem:event.cook');
});
test('ambiguous analysis cannot silently choose a translation interpretation',async()=>{
 const a=await args('I saw the man with the telescope.');const result=translateSurface(a);
 assert.equal(result.success,false);assert.equal(result.needsSelection,true);assert.equal(result.candidates.length,2);assert.equal(result.surface,undefined);
});
test('unknown source input fails explicitly, not with a successful empty output',async()=>{
 const result=translateSurface(await args('This radically unsupported construction cannot match.'));
 assert.equal(result.success,false);assert.equal(result.candidates.length,0);assert.ok(result.diagnostics.some(d=>d.code==='NO_ANALYSIS_CANDIDATES'));
});
test('semantic concept type collisions block translation before generation',async()=>{
 const a=await args('The person cooks the food.');
 const targetLoaded={...a.targetLoaded,concepts:{...a.targetLoaded.concepts,'sem:event.cook':{...a.targetLoaded.concepts['sem:event.cook'],semanticType:'Entity'}}};
 const result=translateSurface({...a,targetLoaded});
 assert.equal(result.success,false);assert.equal(result.diagnostics[0].code,'SHARED_CONCEPT_MISMATCH');
});
test('candidate selection rejects unknown IDs without falling back to the first hypothesis',async()=>{
 const result=translateSurface({...await args('I saw the man with the telescope.'),candidateId:'candidate:invented'});
 assert.equal(result.success,false);assert.equal(result.diagnostics[0].code,'UNKNOWN_ANALYSIS_CANDIDATE');
});
