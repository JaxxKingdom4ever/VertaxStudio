import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject} from '../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../dist/packages/primitives/src/index.js';
import {runPersistedPackTests} from '../../dist/packages/translation/src/index.js';
const p='language-packs/english.vertax';
test('English ships a sizable executable *transitive productivity* corpus (not unrestricted English)',async()=>{
 const r=await loadProject(p);assert.ok(r.project);
 assert.ok(Object.keys(r.project.tests).length>=150);
 const registry=new NodeRegistry();registerCorePrimitives(registry);
 const report=runPersistedPackTests(r.project,registry,{mode:'fast',maxStepsPerStage:100});
 assert.equal(report.failures.length,0,JSON.stringify(report.failures.slice(0,3)));
 assert.equal(report.passed,report.total);
});
test('persisted English acceptance corpus has diversified syntactic families, not just transitive lexical permutations',async()=>{
 const r=await loadProject(p);assert.ok(r.project);
 const familyCounts=new Map();
 for(const entry of Object.values(r.project.tests))for(const assertion of entry.assertions??[]){
  if(!assertion.family)continue;
  familyCounts.set(assertion.family,(familyCounts.get(assertion.family)??0)+1);
 }
 assert.ok(familyCounts.size>=15,JSON.stringify([...familyCounts]));
 assert.ok([...familyCounts].filter(([name,count])=>name!=='transitive'&&count>=4).length>=11,JSON.stringify([...familyCounts]));
 assert.ok(Object.keys(r.project.tests).length>=225);
});
test('persisted English tests exercise relative and complement semantics, lexical degrees and possession',async()=>{
 const r=await loadProject(p);assert.ok(r.project);
 const familyCounts=new Map();
 for(const entry of Object.values(r.project.tests))for(const a of entry.assertions??[]){
   if(a.family)familyCounts.set(a.family,(familyCounts.get(a.family)??0)+1);
 }
 for(const name of ['possessive','plural-possessive','comparative','superlative','adverbial','complement','relative',
                   'past-perfect','future-perfect','perfect-progressive','indefinite-determiner','pronoun-he','pronoun-they']){
   assert.ok((familyCounts.get(name)??0)>=4,`${name} only has ${familyCounts.get(name)??0} cases`);
 }
 assert.ok(Object.keys(r.project.tests).length>=365);
});
