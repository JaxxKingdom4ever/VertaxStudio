import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { loadProject,toCompilerProject,toAnalyzerProject } from '../../../dist/packages/project-model/src/index.js';
import { registerPersistedNodeGroups } from '../../../dist/packages/project-model/src/index.js';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { compileMeaningGraph, analyzeSurface } from '../../../dist/packages/compiler/src/index.js';
import { translateSurface } from '../../../dist/packages/translation/src/index.js';
const root='examples/reference-language.vertax';
const opts={mode:'trace',maxStepsPerStage:150};
const entity=(id,conceptId,type='Entity',features={})=>({id,type,conceptId,roles:{},features:{values:features}});
const meaning=({tense,aspect,polarity,unknown=false}={})=>{
 const a=entity('agent','sem:entity.person',unknown?'Unknown':'Entity');
 const f=entity('food','sem:entity.food');
 const features=Object.fromEntries(Object.entries({tense,aspect,polarity}).filter(([,v])=>v!==undefined));
 return {roots:['cook'],objects:{agent:a,food:f,cook:{id:'cook',type:'Event',conceptId:'sem:event.cook',roles:{agent:['agent'],theme:['food']},features:{values:features}}}};
};
function registry(project){const r=new NodeRegistry();registerCorePrimitives(r);registerPersistedNodeGroups(r,project.nodeGroups);return r;}
let ref;
async function reference(){ref??=(await loadProject(root)).project;assert.ok(ref,'persisted reference language must load from disk');return ref;}
const cases=[
  {title:'question + active progressive',graph:meaning({aspect:'continuous',unknown:true}),expected:"person'vo duru esi'cook food"},
  {title:'plain SVO',graph:meaning({tense:'present'}),expected:'person cook food'},
  {title:'continuous',graph:meaning({aspect:'continuous'}),expected:"person duru esi'cook food"},
  {title:'complete',graph:meaning({aspect:'complete'}),expected:"person ino'cook food"},
  {title:'past',graph:meaning({tense:'past'}),expected:'person cookin food'},
  {title:'future',graph:meaning({tense:'future'}),expected:'person cookas food'},
  {title:'negation',graph:meaning({polarity:'negative'}),expected:'person zar cook food'},
  {title:'agent question',graph:meaning({unknown:true}),expected:"person'vo cook food"},
  {title:'English progressive feature',graph:meaning({aspect:'progressive'}),expected:"person duru esi'cook food"},
  ...[['sem:entity.he','muko'],['sem:entity.she','nuko'],['sem:entity.they','ukolo'],['sem:entity.we','kolo'],['sem:entity.it','oko'],['sem:entity.you','uko'],['sem:entity.first_person','ko']].map(([concept,word])=>({title:`pronoun ${word}`,graph:(()=>{const g=meaning({tense:'present'});g.objects.agent={...g.objects.agent,conceptId:concept};return g})(),expected:`${word} cook food`})),
  {title:'perfect aspect',graph:meaning({aspect:'perfect'}),expected:"person ino'cook food"},
  {title:'object question',graph:(()=>{const g=meaning({tense:'present'});g.objects.food={...g.objects.food,type:'Unknown'};return g})(),expected:"person cook food'vo"},
  {title:'polar question',graph:(()=>{const g=meaning({tense:'present'});g.objects.cook={...g.objects.cook,features:{values:{tense:'present',question:'yesno'}}};return g})(),expected:"person cook'vo food"},
  {title:'imperative put on table',graph:{roots:['put'],objects:{book:entity('book','sem:entity.book'),table:entity('table','sem:entity.table'),put:{id:'put',type:'Event',conceptId:'sem:event.put',roles:{theme:['book'],location:['table']},features:{values:{mood:'imperative'}}}}},expected:"lubik ekumet besato'wudo"}
];
for(const c of cases)test(`persisted reference conlang generates ${c.title} with only core and Node Groups`,async()=>{
 const p=await reference(); const adapted=toCompilerProject(p);
 assert.ok(adapted.project,JSON.stringify(adapted.diagnostics));
 const r=compileMeaningGraph(adapted.project,registry(p),c.graph,opts);
 assert.equal(r.success,true,JSON.stringify(r.diagnostics));
 assert.equal(r.surface,c.expected);
 assert.ok(r.trace.some(s=>s.stage==='Grammar'));
});

test('real source English pack translates to persisted reference conlang across four semantic variants',async()=>{
 const source=(await loadProject('language-packs/english.vertax')).project;
 const target=await reference();
 assert.ok(source&&target);
 for(const [text,output] of [
  ['The person cooks the food.','person cook food'],
  ['The person cooked the food.','person cookin food'],
  ['The person is cooking the food.',"person duru esi'cook food"],
  ['The person will cook the food.','person cookas food'],
  ['She cooked the food.','nuko cookin food'],
  ['He cooked the food.','muko cookin food'],
  ['They cook the food.','ukolo cook food'],
  ['The person does not cook the food.','person zar cook food'],
  ['The person has cooked the food.',"person ino'cook food"]
 ]){
  const translated=translateSurface({sourceProject:toAnalyzerProject(source).project,sourceRegistry:registry(source),targetProject:toCompilerProject(target).project,targetRegistry:registry(target),sourceLoaded:source,targetLoaded:target,text,options:opts});
  assert.equal(translated.success,true,`${text}: ${JSON.stringify(translated.diagnostics)}`);
  assert.equal(translated.surface,output,text);
 }
});

test('reference pack grammar is inspectable, with no ref.* nodes and explicit morphological word boundaries',async()=>{
 const p=await reference();const types=p.stageDocuments.flatMap(d=>d.graph.nodes.map(n=>n.typeId));
 assert.ok(types.some(t=>t.startsWith('node-group:')));
 assert.ok(types.every(t=>!t.startsWith('ref.')));
 assert.ok(Object.values(p.nodeGroups).some(g=>g.internal_graph.nodes.some(n=>n.typeId==='grammar.realize-words')));
 assert.ok(p.tests&&Object.keys(p.tests).length>=9);
});

test('CLI translation and persisted Meaning test runner use registered Node Groups',async()=>{
 const translated=spawnSync(process.execPath,['dist/apps/cli/src/main.js','translate-project','language-packs/english.vertax',root,'The person cooks the food.'],{encoding:'utf8'});
 assert.equal(translated.status,0,translated.stderr);
 assert.equal(translated.stdout.trim(),'person cook food');
 const suite=spawnSync(process.execPath,['dist/apps/cli/src/main.js','test-project',root],{encoding:'utf8'});
 assert.equal(suite.status,0,suite.stderr);
 assert.match(suite.stdout,/\b\d+\/\d+ passed/);
});

test('nonexistent target concept does not silently fall back to a different word',async()=>{
 const p=await reference(),c=toCompilerProject(p).project;
 const graph=meaning();graph.objects.cook={...graph.objects.cook,conceptId:'sem:event.missing'};
 const result=compileMeaningGraph(c,registry(p),graph,opts);
 assert.equal(result.success,false);
 assert.ok(result.diagnostics.some(d=>d.code==='UNSUPPORTED_SEMANTIC_PATTERN'));
});
