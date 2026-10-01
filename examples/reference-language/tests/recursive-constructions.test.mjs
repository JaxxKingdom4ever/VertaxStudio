import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, toCompilerProject, registerPersistedNodeGroups } from '../../../dist/packages/project-model/src/index.js';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
import { compileMeaningGraph } from '../../../dist/packages/compiler/src/index.js';

const base='examples/reference-language.vertax';
const nominal=(id,conceptId,roles={})=>({id,type:'Entity',conceptId,roles,features:{values:{}}});
const event=(id,conceptId,roles,features={})=>({id,type:'Event',conceptId,roles,features:{values:features}});
let loaded;
async function project(){loaded??=(await loadProject(base)).project;assert.ok(loaded);return loaded;}
async function compile(graph){
 const p=await project(),compiled=toCompilerProject(p);assert.ok(compiled.project,JSON.stringify(compiled.diagnostics));
 const r=new NodeRegistry();registerCorePrimitives(r);registerPersistedNodeGroups(r,p.nodeGroups);
 return compileMeaningGraph(compiled.project,r,graph,{mode:'trace',maxStepsPerStage:500});
}
function possessed(depth,owner='sem:entity.first_person'){
 const objects={owner:nominal('owner',owner)};
 let previous='owner';
 for(let i=1;i<=depth;i++){
   const id=`book${i}`;
   objects[id]=nominal(id,'sem:entity.book',{possessor:[previous]});
   previous=id;
 }
 return {objects,rootId:previous};
}
test('standalone project-authored possessed noun handles six levels and keeps provenance of each owner',async()=>{
 const {objects,rootId}=possessed(6);
 const result=await compile({roots:[rootId],objects});
 assert.equal(result.success,true,JSON.stringify(result.diagnostics));
 assert.equal(result.surface,"ko'lez "+Array(6).fill('lubik').join("'lez "));
 const grammar=result.stageResults.Grammar?.values??[];
 assert.equal(grammar.length,7);
 assert.ok(grammar.every(g=>g.data?.segments?.some(s=>s.sourceId)),JSON.stringify(grammar));
});
test('possessed theme survives inside an imperative and a declarative clause',async()=>{
 const {objects,rootId}=possessed(2);
 const baseObjects={...objects,table:nominal('table','sem:entity.table'),person:nominal('person','sem:entity.person')};
 const imperative={roots:['put'],objects:{...baseObjects,put:event('put','sem:event.put',{theme:[rootId],location:['table']},{mood:'imperative'})}};
 const statement={roots:['cook'],objects:{...baseObjects,cook:event('cook','sem:event.cook',{agent:['person'],theme:[rootId]},{tense:'present'})}};
 const a=await compile(imperative);assert.equal(a.success,true,JSON.stringify(a.diagnostics));
 assert.equal(a.surface,"ko'lez lubik'lez lubik ekumet besato'wudo");
 const b=await compile(statement);assert.equal(b.success,true,JSON.stringify(b.diagnostics));
 assert.equal(b.surface,"person cook ko'lez lubik'lez lubik");
});
test('nested modal scope is generated from project-authored realization patterns, not JavaScript target checks',async()=>{
 const p=nominal('person','sem:entity.person'),f=nominal('food','sem:entity.food');
 const cook=event('cook','sem:event.cook',{agent:['person'],theme:['food']},{tense:'present'});
 const need={id:'need',type:'Modality',conceptId:'sem:modality.necessity',roles:{scope:['cook']},features:{values:{}}};
 const possible={id:'possible',type:'Modality',conceptId:'sem:modality.probability',roles:{scope:['need']},features:{values:{}}};
 const r=await compile({roots:['possible'],objects:{person:p,food:f,cook,need,possible}});
 assert.equal(r.success,true,JSON.stringify(r.diagnostics));
 assert.equal(r.surface,'owit yudek person cook food');
});
test('the persisted reference project includes its generated recursive cases, not runtime-only test fixtures',async()=>{
 const p=await project();
 for(const id of ['possessive-one','possessive-two','possessive-three','possessive-six','imperative-possessive','modal-necessity','modal-stacked'])assert.ok(p.tests[id],id);
 assert.ok(Object.keys(p.tests).length>=27);
});

test('nested project-authored modality opens and resolves typed scope obligations',async()=>{
 const person=nominal('person','sem:entity.person'),food=nominal('food','sem:entity.food');
 const cook=event('cook','sem:event.cook',{agent:['person'],theme:['food']},{tense:'present'});
 const need={id:'need',type:'Modality',conceptId:'sem:modality.necessity',roles:{scope:['cook']},features:{values:{}}};
 const possible={id:'possible',type:'Modality',conceptId:'sem:modality.probability',roles:{scope:['need']},features:{values:{}}};
 const r=await compile({roots:['possible'],objects:{person,food,cook,need,possible}});
 assert.equal(r.success,true,JSON.stringify(r.diagnostics));
 const grammar=r.stageResults.Grammar;
 assert.equal(grammar?.state.currentScopeId,'scope:root');
 const modalScopes=Object.values(grammar?.state.scopes??{}).filter(s=>s.type==='ModalScope');
 assert.equal(modalScopes.length,2);
 assert.ok(modalScopes.every(s=>s.status==='RESOLVED'));
 const requirements=Object.values(grammar?.state.requirements??{});
 assert.equal(requirements.length,2);
 assert.ok(requirements.every(r=>r.status==='RESOLVED'));
 assert.deepEqual(new Set(requirements.map(r=>r.resolutionId)),new Set(['need','cook']));
});
