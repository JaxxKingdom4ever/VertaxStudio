import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRegistry,executeGraph,createRuntimeState } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';
const entity=(id,conceptId,type='Entity')=>({id,type,conceptId,roles:{},features:{values:{}}});
const value=entity('agent','sem:entity.person','Unknown');
const food=entity('patient','sem:entity.food');
const event={id:'cook',type:'Event',conceptId:'sem:event.cook',roles:{agent:['agent'],theme:['patient']},features:{values:{aspect:'continuous',tense:'present'}}};
const graph={objects:{agent:value,patient:food,cook:event},roots:['cook']};
const lexeme=(id,conceptId,form)=>({id,conceptId,lexicalClass:'Any',forms:{citation:form},features:{values:{}},valency:[],relatedLexemes:{},irregularRuleIds:[],metadata:{}});
const lexemes=[lexeme('person','sem:entity.person','person'),lexeme('food','sem:entity.food','food'),lexeme('cook','sem:event.cook','cook'),lexeme('vo','sem:op.question','vo'),lexeme('duru','sem:verb.duru','duru'),lexeme('esi','sem:aspect.continuous','esi')];
const resources={lexemes:Object.fromEntries(lexemes.map(x=>[x.id,x])),conceptToLexemeIds:Object.fromEntries(lexemes.map(x=>[x.conceptId,[x.id]])),concepts:{},tables:{},featureDefinitions:{}};
const patterns=[{
 id:'who-cooks',conceptId:'sem:event.cook',features:{aspect:'continuous'},requiredRoles:['agent','theme'],roleTypes:{agent:'Unknown'},
 words:[
   [{role:'agent'},{conceptId:'sem:op.question',kind:'Suffix',joinBefore:"'"}],
   [{conceptId:'sem:verb.duru'}],
   [{conceptId:'sem:aspect.continuous'},{root:true,joinBefore:"'"}],
   [{role:'theme'}]
 ]
}];
const call=(typeId,params,input,ctx)=>{
 const r=new NodeRegistry();registerCorePrimitives(r);
 const g={id:'g',nodes:[{id:'n',typeId,params}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}]};
 return executeGraph(g,r,{state:createRuntimeState(graph),resources,...ctx},{value:[input]});
};

test('generic authored word layouts select by semantic role and preserve all morphology boundaries',()=>{
 const grammar=call('grammar.realize-words',{patterns},event);
 assert.deepEqual(grammar.diagnostics,[]);
 assert.equal(grammar.outputs.value.length,4);
 assert.deepEqual(grammar.outputs.value[0].data.segments.map(x=>x.lexemeId),['person','vo']);
 const words=grammar.outputs.value.map(g=>{
   const m=call('morph.lexical',{},g); assert.deepEqual(m.diagnostics,[]);
   const s=call('surface.join',{separator:''},m.outputs.value[0]);assert.deepEqual(s.diagnostics,[]);return s.outputs.value[0].text;
 });
 assert.deepEqual(words,["person'vo",'duru',"esi'cook",'food']);
 assert.equal(words.join(' '),"person'vo duru esi'cook food");
});

test('word realization rejects unmatched structures rather than making up a fallback',()=>{
 const nonMatch=call('grammar.realize-words',{patterns},{...event,conceptId:'sem:event.eat'});
 assert.ok(nonMatch.diagnostics.some(d=>d.code==='UNSUPPORTED_SEMANTIC_PATTERN'));
 assert.deepEqual(nonMatch.outputs.value,[]);
});

test('equal ranking patterns fail explicitly rather than silently choosing one',()=>{
 const tied=call('grammar.realize-words',{patterns:[patterns[0],{...patterns[0],id:'another-pattern'}]},event);
 assert.ok(tied.diagnostics.some(d=>d.code==='AMBIGUOUS_WORD_PATTERN'));
});

test('authored zero morph remains explicit and empty on Surface',()=>{
 const zero=call('grammar.realize-words',{patterns:[{...patterns[0],id:'zero',words:[[{role:'agent'},{featureId:'present',kind:'Zero'}]]}]},event);
 const morph=call('morph.lexical',{},zero.outputs.value[0]);
 assert.equal(morph.outputs.value[0].morphs[1].kind,'Zero');
 const surface=call('surface.join',{separator:"'"},morph.outputs.value[0]);
 assert.equal(surface.outputs.value[0].text,'person');
});
