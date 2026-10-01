import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {runPersistedPackTests} from '../../../dist/packages/translation/src/index.js';

const registry=new NodeRegistry();registerCorePrimitives(registry);
let projectPromise;
async function get(){projectPromise??=loadProject('language-packs/english.vertax');const r=await projectPromise;assert.ok(r.project);return r.project;}
for(const [field,wrongValue] of [
 ['rootType','State'],
 ['rootFeatures',{tense:'future'}],
 ['roleConcepts',{agent:'sem:entity.rock'}],
 ['roleTypes',{theme:'Unknown'}],
]){
 test(`persisted language test runner rejects wrong ${field} rather than silently ignoring it`,async()=>{
  const original=await get();const sample=original.tests['test:en:transitive:001'];assert.ok(sample);
  const wrong={...sample,expected_output:{...sample.expected_output,[field]:wrongValue}};
  const report=runPersistedPackTests({...original,tests:{[wrong.id]:wrong}},registry,{mode:'fast',maxStepsPerStage:100});
  assert.equal(report.passed,0);
  assert.equal(report.failures.length,1);
  assert.match(report.failures[0].message,new RegExp(field));
 });
}
