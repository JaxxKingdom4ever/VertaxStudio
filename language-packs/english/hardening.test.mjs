import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadProject,toAnalyzerProject,toCompilerProject} from '../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../dist/packages/primitives/src/index.js';
import {analyzeSurface,compileMeaningGraph} from '../../dist/packages/compiler/src/index.js';
const registry=new NodeRegistry();registerCorePrimitives(registry);
const opts={mode:'trace',maxStepsPerStage:400};
let cached;
async function pack(){cached??=(await loadProject('language-packs/english.vertax')).project;assert.ok(cached);return cached;}
test('candidate-level provenance traces lexical source tokens, not only hidden object annotations',async()=>{
 const a=analyzeSurface(toAnalyzerProject(await pack()).project,registry,'The girl cooked the food.',opts);
 assert.equal(a.success,true);assert.equal(a.candidates.length,1);
 assert.ok(a.candidates[0].provenance.length>=3);
 assert.ok(a.candidates[0].provenance.some(r=>r.note==='cooked'));
});
test('candidate IDs, interpretation ordering and execution traces are deterministic for 25 runs',async()=>{
 const p=toAnalyzerProject(await pack()).project;
 const snapshot=()=>{
  const a=analyzeSurface(p,registry,'I saw the man with the telescope.',opts);
  assert.equal(a.candidates.length,2);assert.equal(a.success,true);
  return JSON.stringify({ids:a.candidates.map(x=>x.id),graphs:a.candidates.map(x=>x.meaning),trace:a.trace,provenance:a.candidates.map(x=>x.provenance)});
 };
 const baseline=snapshot();for(let i=0;i<25;i++)assert.equal(snapshot(),baseline,`iteration ${i}`);
});
test('deep embedded semantics are generated recursively with no source-language token copying',async()=>{
 const p=toCompilerProject(await pack()).project;
 const objects={a:{id:'a',type:'Entity',conceptId:'sem:entity.girl',roles:{},features:{values:{}}},
                t:{id:'t',type:'Entity',conceptId:'sem:entity.food',roles:{},features:{values:{}}}};
 for(let i=7;i>=0;i--){const isLeaf=i===7;objects[`e${i}`]={id:`e${i}`,type:'Event',conceptId:isLeaf?'sem:event.cook':'sem:event.say',
  roles:isLeaf?{agent:['a'],theme:['t']}:{agent:['a'],complement:[`e${i+1}`]},
  features:{values:isLeaf?{tense:'past'}:{tense:'past',syntax:'complement'}}};}
 const g=compileMeaningGraph(p,registry,{roots:['e0'],objects},opts);
 assert.equal(g.success,true,JSON.stringify(g.diagnostics));
 assert.equal(g.surface,`The girl ${'said that the girl '.repeat(7)}cooked the food.`);
});
test('unknown uppercase and lowercase lexical material cannot silently become an unrelated known entity',async()=>{
 const p=toAnalyzerProject(await pack()).project;
 for(const sentence of ['The flibbertigibbet cooked the food.','The Flibbertigibbet cooked the food.']){
  const a=analyzeSurface(p,registry,sentence,opts);
  assert.equal(a.success,false,sentence);assert.equal(a.candidates.length,0,sentence);
  assert.ok(a.diagnostics.some(d=>d.code==='NO_ANALYSIS_CANDIDATES'));
 }
});
test('no core, runtime, compiler or project-model source branches on English language names or locale IDs',()=>{
 for(const folder of ['compiler','core-types','runtime','primitives','project-model']){
  const src=join('packages',folder,'src');
  for(const name of readdirSync(src))if(name.endsWith('.ts')){
   const body=readFileSync(join(src,name),'utf8');
   assert.doesNotMatch(body,/if\s*\([^)]*\b(?:language|lang|locale|languageId)\s*={2,3}\s*['"](?:en|English|en-US)['"]/i,`${folder}/${name}`);
  }
 }
});
