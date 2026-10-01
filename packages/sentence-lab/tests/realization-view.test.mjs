import test from 'node:test';import assert from 'node:assert/strict';
import {buildSurfaceTraceSpans,buildGlossUnits,buildStructureSections} from '../../../dist/packages/sentence-lab/src/index.js';
import {surfaceFromSegments} from '../../../dist/packages/primitives/src/index.js';
const formed=surfaceFromSegments('formed',[
 {kind:'Grapheme',text:'esi',sourceIds:['m:prefix','event:cook'],nodeIds:['node:spell']},
 {kind:'Boundary',text:"'",sourceIds:['m:root'],nodeIds:['node:spell']},
 {kind:'Grapheme',text:'cook',sourceIds:['m:root','event:cook'],nodeIds:['node:spell']}
]);
const surface={state:{},values:[formed],diagnostics:[],trace:[],debugFrames:[],success:true};
const morphology={...surface,values:[{id:'m',morphs:[{id:'m:zero',kind:'Zero',featureId:'present',features:{values:{tense:'Present'}}},{id:'m:root',kind:'Root',form:'cook',features:{values:{}}}]}]};
const phonology={...surface,values:[{id:'p',valueType:'PhonologicalForm',zeroMorphIds:['m:zero'],tokens:[]}]};
const result={success:true,surface:"esi'cook",diagnostics:[],trace:[],debugFrames:[],stageResults:{Morphology:morphology,Phonology:phonology,Surface:surface}};
test('Lab Gloss displays zero morph and Structure shows actual Phonology value',()=>{
 assert.equal(buildGlossUnits(result)[0].form,'∅');
 assert.ok(buildStructureSections(result).some(x=>x.stage==='Phonology'&&x.values[0].zeroMorphIds[0]==='m:zero'));
});
test('Lab final spans preserve source and authoring node IDs without altering final surface',()=>{
 const spans=buildSurfaceTraceSpans(result);
 assert.equal(spans.map(s=>s.text).join(''),"esi'cook");
 assert.deepEqual(spans[0].nodeIds,['node:spell']);
 assert.deepEqual(spans[0].sourceIds,['m:prefix','event:cook']);
 assert.equal(spans[1].text,"'");
});
