import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,toCompilerProject,registerPersistedNodeGroups} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {compileMeaningGraph} from '../../../dist/packages/compiler/src/index.js';

const path='examples/reference-language.vertax';
const entity=(id,conceptId='sem:entity.person',roles={})=>({id,type:'Entity',conceptId,roles,features:{values:{}}});
const prop=(id,degree)=>({id,type:'Property',conceptId:'sem:property.tall',roles:{},features:{values:degree?{degree}:{}}});
const event=(id,agent='person',theme='food')=>({id,type:'Event',conceptId:'sem:event.cook',roles:{agent:[agent],theme:[theme]},features:{values:{tense:'present'}}});
const collection=(mode,members)=>({id:'coord',type:'SemanticList',conceptId:'sem:list.coordination',roles:{members},features:{values:{mode}}});
const comparison=(degree)=>({id:'compare',type:'Relation',conceptId:'sem:relation.comparison',roles:{first:['person'],property:['tall'],second:['food']},features:{values:{degree}}});
let loaded;
async function generate(graph){
 loaded??=(await loadProject(path)).project;
 assert.ok(loaded);
 const c=toCompilerProject(loaded); assert.ok(c.project,JSON.stringify(c.diagnostics));
 const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,loaded.nodeGroups);
 return compileMeaningGraph(c.project,registry,graph,{mode:'trace',maxStepsPerStage:500});
}
const emit=async graph=>{const result=await generate(graph);assert.equal(result.success,true,JSON.stringify(result.diagnostics));return result;};

test('a persisted dynamic-add list conjoins the authored verb to each following item, including the third',async()=>{
 const objects={me:entity('me','sem:entity.first_person'),person:entity('person'),food:entity('food','sem:entity.food'),coord:collection('add',['me','person','food'])};
 const r=await emit({roots:['coord'],objects});
 assert.equal(r.surface,"ko ⟦ADD⟧'person ⟦ADD⟧'food");
 assert.equal(r.stageResults.Grammar.values.length,3);
 assert.ok(r.stageResults.Grammar.values[1].data.segments[0].sourceId==='coord');
});

test('alternative and contrast are data-selected tail operators; contrast can join whole clauses',async()=>{
 const base={person:entity('person'),food:entity('food','sem:entity.food'),book:entity('book','sem:entity.book')};
 const alternate=await emit({roots:['coord'],objects:{...base,coord:collection('alternative',['person','food','book'])}});
 assert.equal(alternate.surface,"person ⟦OR⟧'food ⟦OR⟧'lubik");
 const contrast=await emit({roots:['coord'],objects:{...base,first:event('first'),second:event('second','person','book'),coord:collection('contrast',['first','second'])}});
 assert.equal(contrast.surface,"person cook food ⟦BUT⟧'person cook lubik");
});

test('a coordinated member may itself have recursively possessed structure',async()=>{
 const objects={person:entity('person'),me:entity('me','sem:entity.first_person'),book:entity('book','sem:entity.book',{possessor:['me']}),coord:collection('add',['person','book'])};
 const r=await emit({roots:['coord'],objects});
 assert.equal(r.surface,"person ⟦ADD⟧'ko'lez lubik");
});

test('a coordination list requires two elements and a complete semantic graph',async()=>{
 const r=await generate({roots:['coord'],objects:{person:entity('person'),coord:collection('add',['person'])}});
 assert.equal(r.success,false);
 assert.ok(r.diagnostics.some(d=>d.code==='SEMANTIC_ROLE_CARDINALITY'),JSON.stringify(r.diagnostics));
});

test('comparison suffix attaches to the FIRST comparison subject, not the property or second subject',async()=>{
 const base={person:entity('person'),food:entity('food','sem:entity.food'),tall:prop('tall')};
 for(const [degree,suffix] of [['more','pu'],['less','mo'],['equal','ga']]){
   const r=await emit({roots:['compare'],objects:{...base,compare:comparison(degree)}});
   assert.equal(r.surface,`person'${suffix} ⟦TALL⟧ food`,degree);
 }
});

test('first subject retains possession and the comparison suffix attaches to its final word',async()=>{
 const objects={owner:entity('owner','sem:entity.first_person'),person:entity('person','sem:entity.person',{possessor:['owner']}),food:entity('food','sem:entity.food'),tall:prop('tall'),compare:comparison('more')};
 const r=await emit({roots:['compare'],objects});
 assert.equal(r.surface,"ko'lez person'pu ⟦TALL⟧ food");
});

test('superlatives mark the property, distinct from comparative subject attachment',async()=>{
 for(const [degree,suffix] of [['highest','pu'],['lowest','mo']]){
  const r=await emit({roots:['tall'],objects:{tall:prop('tall',degree)}});
  assert.equal(r.surface,`⟦TALL⟧'${suffix}`);
 }
});

test('unsupported comparison degree is rejected, not flattened to a lexical leaf',async()=>{
 const objects={person:entity('person'),food:entity('food','sem:entity.food'),tall:prop('tall'),compare:comparison('unknown')};
 const r=await generate({roots:['compare'],objects});
 assert.equal(r.success,false);
 assert.ok(r.diagnostics.some(d=>d.code==='UNSUPPORTED_SEMANTIC_PATTERN'),JSON.stringify(r.diagnostics));
});

test('coordination/comparison acceptance examples are persisted as editable project tests',async()=>{
  loaded??=(await loadProject(path)).project;
  const ids=['coordination-add-three','coordination-add-four','coordination-add-possession','coordination-add-nested','coordination-alternative-two','coordination-alternative-three','coordination-contrast-clauses','coordination-contrast-three','comparison-more','comparison-less','comparison-equal','comparison-possessed-first','comparison-possessed-second','comparison-coordinated-second','superlative-highest','superlative-lowest'];
  for(const id of ids){
    assert.ok(loaded.tests[id],`missing persisted test ${id}`);
    assert.equal(loaded.tests[id].input_stage,'Meaning',id);
    assert.equal(loaded.tests[id].expected_stage,'Surface',id);
  }
});
