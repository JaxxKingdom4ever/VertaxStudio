import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAnalysisPrimitives } from '../../../dist/packages/primitives/src/index.js';
import { createRuntimeState,NodeRegistry } from '../../../dist/packages/runtime/src/index.js';
const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
const lexeme=(id,conceptId,lexicalClass,forms)=>({id,conceptId,lexicalClass,forms,features:{values:{}},valency:[],relatedLexemes:{},irregularRuleIds:[],metadata:{}});
const lexemes={a:lexeme('a','sem:see','Verb',{past:'saw',participle:'seen',citation:'see'}),b:lexeme('b','sem:saw','Noun',{citation:'saw'}),c:lexeme('c','sem:person','Noun',{citation:'man'}),d:lexeme('d','sem:instrument','Noun',{citation:'telescope'})};
const ctx={state:createRuntimeState({objects:{},roots:[]}),resources:{lexemes,concepts:{},tables:{},featureDefinitions:{},conceptToLexemeIds:{}}};
const run=(id,input,params={})=>reg.get(id).evaluate(ctx,{value:[input]},params);
test('tokenizer keeps source spelling and punctuation spans with normalized words',()=>{
 const o=run('analysis.tokenize',{valueType:'SourceText',id:'source',text:'Saw—telescope,   Cooked!'});
 assert.deepEqual(o.diagnostics,[]);
 assert.deepEqual(o.outputs.value[0].tokens.map(t=>[t.text,t.normalized,t.start,t.end]),[['Saw','saw',0,3],['—','—',3,4],['telescope','telescope',4,13],[',',',',13,14],['Cooked','cooked',17,23],['!','!',23,24]]);
});
test('lexicon lookup returns homographs and all syncretic forms, not first-match guesses',()=>{
 const r=run('analysis.tokenize',{valueType:'SourceText',id:'s',text:'Saw seen'});
 const m=run('analysis.lexeme-lookup',r.outputs.value[0]);
 assert.deepEqual(m.outputs.value[0].tokens[0].options.map(o=>[o.lexemeId,o.formKey]),[['a','past'],['b','citation']]);
 assert.deepEqual(m.outputs.value[0].tokens[1].options.map(o=>[o.lexemeId,o.formKey]),[['a','participle']]);
});
test('unknown lowercase token remains unknown rather than being silently replaced',()=>{
 const tokens=run('analysis.tokenize',{valueType:'SourceText',id:'s',text:'saw flibbertigibbet'}).outputs.value[0];
 const m=run('analysis.lexeme-lookup',tokens);
 assert.equal(m.outputs.value[0].tokens[1].options.length,0);
 assert.equal(m.diagnostics.find(d=>d.code==='UNKNOWN_LEXEME').severity,'Warning');
});
test('two structural patterns can produce two differently attached semantic hypotheses',()=>{
 const tokens=run('analysis.tokenize',{valueType:'SourceText',id:'s',text:'Saw man'}).outputs.value[0];
 const morph=run('analysis.lexeme-lookup',tokens).outputs.value[0];
 const variants=[
 {id:'x',slots:[{classes:['Verb'],formKeys:['past']},{classes:['Noun']}],meaning:{root:'event',objects:[{id:'event',type:'Event',conceptId:'sem:see',roles:{patient:['man']}},{id:'man',type:'Entity',slot:1}]}},
 {id:'y',slots:[{classes:['Verb'],formKeys:['past']},{classes:['Noun']}],meaning:{root:'event',objects:[{id:'event',type:'Event',conceptId:'sem:see',roles:{instrument:['man']}},{id:'man',type:'Entity',slot:1}]}}
 ];
 const parse=run('analysis.match-pattern',morph,{patterns:variants});
 assert.equal(parse.outputs.value.length,2);
 const values=parse.outputs.value.map(v=>run('analysis.to-meaning',v).outputs.value[0]);
 assert.equal(values[0].graph.objects.event.roles.patient[0],'man');
 assert.equal(values[1].graph.objects.event.roles.instrument[0],'man');
 assert.equal(values[0].graph.objects.man.conceptId,'sem:person');
});
test('tokenizer preserves English plural genitive as one lexical token with correct source offsets',()=>{
 const value=run('analysis.tokenize',{valueType:'SourceText',id:'s',text:"The girls' book."});
 assert.deepEqual(value.outputs.value[0].tokens.map(t=>[t.text,t.start,t.end]),[['The',0,3],["girls'",4,10],['book',11,15],['.',15,16]]);
});
