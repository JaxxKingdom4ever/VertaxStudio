import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,toCompilerProject,registerPersistedNodeGroups} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {compileMeaningGraph} from '../../../dist/packages/compiler/src/index.js';

const entity=(id,conceptId)=>({id,type:'Entity',conceptId,roles:{},features:{values:{}}});
const event=(id,conceptId,roles,features={})=>({id,type:'Event',conceptId,roles,features:{values:features}});
const relation=(id,condition,consequence)=>({id,type:'Relation',conceptId:'sem:relation.conditional',roles:{condition:[condition],consequence:[consequence]},features:{values:{}}});
const base=()=>({
  me:entity('me','sem:entity.first_person'),person:entity('person','sem:entity.person'),food:entity('food','sem:entity.food'),
  cook:event('cook','sem:event.cook',{agent:['person'],theme:['food']},{tense:'present'})
});
let loaded;
async function compile(graph){
 loaded??=(await loadProject('examples/reference-language.vertax')).project;
 assert.ok(loaded,'The project must load');
 const adapted=toCompilerProject(loaded);
 assert.ok(adapted.project,JSON.stringify(adapted.diagnostics));
 const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,loaded.nodeGroups);
 return compileMeaningGraph(adapted.project,registry,graph,{mode:'trace',maxStepsPerStage:500});
}
const assertSuccess=(r,expected)=>{assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.equal(r.surface,expected);};

test('an authored complement caller precedes its fully expanded event complement',async()=>{
 const objects={...base(),caller:event('caller','sem:verb.duru',{agent:['me'],complement:['cook']})};
 const r=await compile({roots:['caller'],objects});assertSuccess(r,'ko duru person cook food');
 const scope=Object.values(r.stageResults.Grammar.state.scopes).find(s=>s.type==='Complement');
 assert.equal(scope?.status,'RESOLVED');
 assert.equal(r.stageResults.Grammar.state.requirements[scope.requirementIds[0]].resolutionId,'cook');
 assert.equal(r.stageResults.Grammar.state.currentScopeId,'scope:root');
});

test('nested complement calls create nested child scopes and return to their parent',async()=>{
 const objects={...base(),inner:event('inner','sem:verb.duru',{agent:['me'],complement:['cook']}),outer:event('outer','sem:verb.duru',{agent:['me'],complement:['inner']})};
 const r=await compile({roots:['outer'],objects});assertSuccess(r,'ko duru ko duru person cook food');
 const scopes=Object.values(r.stageResults.Grammar.state.scopes).filter(s=>s.type==='Complement');
 assert.equal(scopes.length,2);
 assert.ok(scopes.every(s=>s.status==='RESOLVED'));
 assert.ok(scopes.some(s=>s.parentId==='scope:root'));
 assert.ok(scopes.some(s=>scopes.some(parent=>parent.id===s.parentId)));
 assert.deepEqual(new Set(scopes.map(s=>r.stageResults.Grammar.state.requirements[s.requirementIds[0]].resolutionId)),new Set(['inner','cook']));
});

test('the complement caller keeps negation outside the nested complement scope',async()=>{
 const objects={...base(),caller:event('caller','sem:verb.duru',{agent:['me'],complement:['cook']},{polarity:'negative'})};
 const r=await compile({roots:['caller'],objects});assertSuccess(r,'ko zar duru person cook food');
});

test('wrong semantic type for complement produces a structured Requirement mismatch, never partial output',async()=>{
 const objects={...base(),caller:event('caller','sem:verb.duru',{agent:['me'],complement:['food']})};
 const r=await compile({roots:['caller'],objects});
 assert.equal(r.success,false);
 assert.ok(r.diagnostics.some(d=>d.code==='REQUIREMENT_TYPE_MISMATCH'),JSON.stringify(r.diagnostics));
 assert.equal(r.surface,undefined);
});

test('conditional -sa attaches to the subordinate subject, not the main-clause subject',async()=>{
 const objects={...base(),condition:event('condition','sem:event.cook',{agent:['me'],theme:['food']},{clause:'conditional'}),if1:relation('if1','condition','cook')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,'kosa cook food person cook food');
 const conditionalScopes=Object.values(r.stageResults.Grammar.state.scopes).filter(s=>s.type==='ConditionalScope');
 assert.equal(conditionalScopes.length,1);assert.equal(conditionalScopes[0].status,'RESOLVED');
 const requirement=r.stageResults.Grammar.state.requirements[conditionalScopes[0].requirementIds[0]];
 assert.equal(requirement.resolutionId,'condition');
 assert.equal(r.stageResults.Grammar.state.currentScopeId,'scope:root');
 const conditionalSuffix=r.stageResults.Grammar.values.flatMap(word=>word.data?.segments??[])
   .find(segment=>segment.lexemeId==='lex:op.conditional');
 assert.equal(conditionalSuffix?.sourceId,'condition','suffix should retain the owning subordinate clause provenance');
});

test('impersonal conditional -sa instead attaches to the subordinate verb',async()=>{
 const objects={...base(),condition:event('condition','sem:event.cook',{theme:['food']},{clause:'conditional',impersonal:true}),if1:relation('if1','condition','cook')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,'cooksa food person cook food');
});

test('conditional and past tense both survive on their distinct targets',async()=>{
 const objects={...base(),condition:event('condition','sem:event.cook',{agent:['me'],theme:['food']},{clause:'conditional',tense:'past'}),if1:relation('if1','condition','cook')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,'kosa cookin food person cook food');
});

test('the impersonal conditional can be negative without placing the suffix on a missing subject',async()=>{
 const objects={...base(),condition:event('condition','sem:event.cook',{theme:['food']},{clause:'conditional',impersonal:true,polarity:'negative'}),if1:relation('if1','condition','cook')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,'zar cooksa food person cook food');
});

test('the conditional suffix follows a recursively expanded possessed subject',async()=>{
 const objects={...base(),book:{...entity('book','sem:entity.book'),roles:{possessor:['me']}},condition:event('condition','sem:event.cook',{agent:['book'],theme:['food']},{clause:'conditional'}),if1:relation('if1','condition','cook')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,"ko'lez lubiksa cook food person cook food");
});

test('negation in a conditional only affects the subordinate clause, not the consequence',async()=>{
 const objects={...base(),condition:event('condition','sem:event.cook',{agent:['me'],theme:['food']},{clause:'conditional',polarity:'negative'}),if1:relation('if1','condition','cook')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,'kosa zar cook food person cook food');
});

test('negation in a consequence does not leak into the conditional clause',async()=>{
 const objects={...base(),condition:event('condition','sem:event.cook',{agent:['me'],theme:['food']},{clause:'conditional'}),cook:event('cook','sem:event.cook',{agent:['person'],theme:['food']},{polarity:'negative'}),if1:relation('if1','condition','cook')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,'kosa cook food person zar cook food');
});

test('nested conditions resolve independent typed scopes with no marker leakage',async()=>{
 const objects={...base(),c1:event('c1','sem:event.cook',{agent:['me'],theme:['food']},{clause:'conditional'}),c2:event('c2','sem:event.cook',{agent:['person'],theme:['food']},{clause:'conditional'}),if2:relation('if2','c2','cook'),if1:relation('if1','c1','if2')};
 const r=await compile({roots:['if1'],objects});assertSuccess(r,'kosa cook food personsa cook food person cook food');
 const scopes=Object.values(r.stageResults.Grammar.state.scopes);
 assert.equal(scopes.filter(s=>s.type==='ConditionalScope').length,2);
 assert.ok(scopes.filter(s=>s.type!=='Root').every(s=>s.status==='RESOLVED'));
 assert.equal(r.stageResults.Grammar.state.currentScopeId,'scope:root');
});

test('conditional target cannot be an unrelated Entity',async()=>{
 const objects={...base(),if1:relation('if1','food','cook')};
 const r=await compile({roots:['if1'],objects});
 assert.equal(r.success,false);assert.ok(r.diagnostics.some(d=>d.code==='REQUIREMENT_TYPE_MISMATCH'),JSON.stringify(r.diagnostics));
});

test('a conditional requires its embedded event to carry conditional mood, rather than dropping -sa',async()=>{
 const objects={...base(),if1:relation('if1','cook','cook')};
 const r=await compile({roots:['if1'],objects});
 assert.equal(r.success,false);
 assert.ok(r.diagnostics.some(d=>d.code==='REQUIREMENT_FEATURE_MISMATCH'),JSON.stringify(r.diagnostics));
 assert.equal(r.surface,undefined);
});

test('a complement call can return an entire conditional proposition without dropping the relation',async()=>{
 const objects={...base(),condition:event('condition','sem:event.cook',{agent:['me'],theme:['food']},{clause:'conditional'}),if1:relation('if1','condition','cook'),caller:event('caller','sem:verb.duru',{agent:['me'],complement:['if1']})};
 const r=await compile({roots:['caller'],objects});assertSuccess(r,'ko duru kosa cook food person cook food');
 assert.equal(Object.values(r.stageResults.Grammar.state.requirements).filter(r=>r.status==='RESOLVED').length,3);
});

test('the authored complement and conditional cases are persisted as .vertax project tests',async()=>{
 loaded??=(await loadProject('examples/reference-language.vertax')).project;
 assert.ok(loaded);
 for(const id of ['complement-basic','complement-nested','condition-personal','condition-impersonal','condition-negative','condition-nested','complement-conditional'])assert.ok(loaded.tests[id],id);
});

test('abstract conditional relations do not introduce empty lexical words into the pack',async()=>{
 loaded??=(await loadProject('examples/reference-language.vertax')).project;
 assert.ok(loaded);
 assert.ok(loaded.concepts['sem:relation.conditional']);
 assert.equal(Object.values(loaded.lexemes).some(x=>x.conceptId==='sem:relation.conditional'),false);
});
