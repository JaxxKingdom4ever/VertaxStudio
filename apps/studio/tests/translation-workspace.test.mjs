import test from 'node:test';
import assert from 'node:assert/strict';
import {pickLanguagePacks,translationView} from '../../../dist/apps/studio/src/translation-workspace.js';
const catalog=[{id:'english-pack',path:'english.vertax',capabilities:['analyze','generate']},{id:'target-only',path:'target.vertax',capabilities:['generate']},{id:'other',path:'other.vertax',capabilities:[]}];
test('translation selectors are driven by declared language-pack capabilities',()=>{
 const x=pickLanguagePacks(catalog);
 assert.deepEqual(x.sources.map(v=>v.id),['english-pack']);assert.deepEqual(x.targets.map(v=>v.id),['english-pack','target-only']);
});
test('ambiguous result requires explicit candidate selection and never presents target output',()=>{
 const x=translationView({success:false,needsSelection:true,candidates:[{id:'m1',meaning:{objects:{},roots:[]},diagnostics:[]},{id:'m2',meaning:{objects:{},roots:[]},diagnostics:[]}],diagnostics:[]});
 assert.equal(x.surface,undefined);assert.equal(x.candidates.length,2);assert.equal(x.requiresSelection,true);
});
