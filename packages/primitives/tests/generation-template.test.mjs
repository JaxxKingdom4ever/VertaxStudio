import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeRegistry,createRuntimeState} from '../../../dist/packages/runtime/src/index.js';
import {registerAnalysisPrimitives} from '../../../dist/packages/primitives/src/index.js';
const lex=(id,c,forms)=>({id,conceptId:c,lexicalClass:'Noun',forms,features:{values:{}},valency:[],relatedLexemes:{},irregularRuleIds:[],metadata:{}});
const resources={concepts:{},featureDefinitions:{},tables:{},conceptToLexemeIds:{'sem:entity.person':['person'],'sem:event.cook':['cook']},lexemes:{person:lex('person','sem:entity.person',{citation:'person'}),cook:lex('cook','sem:event.cook',{citation:'cook',present3:'cooks'})}};
const event={id:'e',type:'Event',conceptId:'sem:event.cook',roles:{agent:['a']},features:{values:{tense:'present'}}};
const graph={roots:['e'],objects:{e:event,a:{id:'a',type:'Entity',conceptId:'sem:entity.person',roles:{},features:{values:{}}}}};
test('project-authored realization template resolves semantic role without language branches',()=>{
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 const patterns=[{id:'normal',conceptId:'sem:event.cook',features:{tense:'present'},parts:[{literal:'the'},{role:'agent',formKey:'citation'},{root:true,formKey:'present3'},{literal:'.'}],capitalize:true}];
 const result=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(graph),resources},{value:[event]},{patterns});
 assert.deepEqual(result.diagnostics,[]);
 assert.equal(result.outputs.value[0].kind,'MorphCandidate');
 assert.equal(result.outputs.value[0].data.form,'The person cooks.');
});
test('unrecognized semantic patterns error rather than substitute an unrelated sentence',()=>{
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 const result=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(graph),resources},{value:[event]},{patterns:[]});
 assert.equal(result.outputs.value.length,0);
 assert.equal(result.diagnostics[0].code,'UNSUPPORTED_SEMANTIC_PATTERN');
});
test('generic role-path realization reads nested group members without flattening structure',()=>{
 const nested={roots:['s'],objects:{
  s:{id:'s',type:'State',conceptId:'sem:state.present',features:{values:{}},roles:{subject:['g']}},
  g:{id:'g',type:'Group',conceptId:'sem:group.coordination',features:{values:{number:'plural'}},roles:{members:['a','b']}},
  a:{id:'a',type:'Entity',conceptId:'sem:entity.person',features:{values:{}},roles:{}},
  b:{id:'b',type:'Entity',conceptId:'sem:entity.person',features:{values:{}},roles:{}}
 }};
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 const result=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(nested),resources},{value:[nested.objects.s]},{patterns:[{
  id:'group',conceptId:'sem:state.present',parts:[
   {path:[{role:'subject'},{role:'members',index:0}]},{literal:'and'},{path:[{role:'subject'},{role:'members',index:1}]},{literal:'.'}],capitalize:true
 }]});
 assert.deepEqual(result.diagnostics,[]);
 assert.equal(result.outputs.value[0].data.form,'Person and person.');
});
test('declarative generation can select allomorph patterns from nested role features',()=>{
 const plural={roots:['e'],objects:{
  e:{...event,roles:{agent:['a']},features:{values:{tense:'present',aspect:'progressive'}}},
  a:{id:'a',type:'Entity',conceptId:'sem:entity.person',roles:{},features:{values:{number:'plural'}}}
 }};
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 const result=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(plural),resources},{value:[plural.objects.e]},{patterns:[
  {id:'singular',conceptId:'sem:event.cook',features:{aspect:'progressive'},requiredRoles:['agent'],parts:[{literal:'is'},{root:true}]},
  {id:'plural',conceptId:'sem:event.cook',features:{aspect:'progressive'},roleFeatures:{agent:{number:'plural'}},requiredRoles:['agent'],parts:[{literal:'are'},{root:true}]}
 ]});
 assert.equal(result.outputs.value[0]?.data.form,'are cook');
});
test('generation never silently drops a semantic role that no selected template realizes',()=>{
 const extra={...graph,objects:{...graph.objects,e:{...event,roles:{agent:['a'],recipient:['b']},features:{values:{tense:'present'}}},b:{id:'b',type:'Entity',conceptId:'sem:entity.person',roles:{},features:{values:{}}}}};
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 const result=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(extra),resources},{value:[extra.objects.e]},{patterns:[
  {id:'unlicensed',conceptId:'sem:event.cook',features:{tense:'present'},requiredRoles:['agent'],parts:[{role:'agent'}, {root:true}, {literal:'.'}]}
 ]});
 assert.equal(result.outputs.value.length,0);
 assert.equal(result.diagnostics[0].code,'UNSUPPORTED_SEMANTIC_PATTERN');
});
test('a persisted realization pattern can embed another semantic clause without concatenating source text',()=>{
 const compound={roots:['outer'],objects:{
  outer:{id:'outer',type:'Event',conceptId:'sem:event.say',roles:{agent:['a'],complement:['inner']},features:{values:{tense:'past'}}},
  inner:{id:'inner',type:'Event',conceptId:'sem:event.cook',roles:{agent:['a'],theme:['b']},features:{values:{tense:'past'}}},
  a:{id:'a',type:'Entity',conceptId:'sem:entity.person',roles:{},features:{values:{}}},
  b:{id:'b',type:'Entity',conceptId:'sem:entity.person',roles:{},features:{values:{}}}
 }};
 const withSay={...resources,lexemes:{...resources.lexemes,cook:lex('cook','sem:event.cook',{citation:'cook',past:'cooked'}),say:lex('say','sem:event.say',{citation:'say',past:'said'})},conceptToLexemeIds:{...resources.conceptToLexemeIds,'sem:event.say':['say']}};
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 const patterns=[
  {id:'outer',conceptId:'sem:event.say',requiredRoles:['agent','complement'],parts:[
   {literal:'the'},{role:'agent'},{root:true,formKey:'past'},{literal:'that'},
   {embeddedRole:'complement',lowercaseInitial:true,dropFinalPunctuation:true},{literal:'.'}],capitalize:true},
  {id:'inner',conceptId:'sem:event.cook',requiredRoles:['agent','theme'],parts:[
   {literal:'the'},{role:'agent'},{root:true,formKey:'past'},{literal:'the'},{role:'theme'},{literal:'.'}],capitalize:true}
 ];
 const output=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(compound),resources:withSay},{value:[compound.objects.outer]},{patterns});
 assert.deepEqual(output.diagnostics,[]);
 assert.equal(output.outputs.value[0].data.form,'The person said that the person cooked the person.');
});
test('recursive realization detects semantic graph cycles instead of overflowing',()=>{
 const cyclic={roots:['e'],objects:{e:{id:'e',type:'Event',conceptId:'sem:event.cook',roles:{complement:['e']},features:{values:{}}}}};
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 const output=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(cyclic),resources},{value:[cyclic.objects.e]},{patterns:[
  {id:'cycle',conceptId:'sem:event.cook',requiredRoles:['complement'],parts:[{embeddedRole:'complement'}]}
 ]});
 assert.equal(output.outputs.value.length,0);
 assert.equal(output.diagnostics[0].code,'RECURSIVE_REALIZATION');
});
test('malformed persisted nested-path parameters return diagnostics rather than throw during generation',()=>{
 const reg=new NodeRegistry();registerAnalysisPrimitives(reg);
 for(const malformed of [
  {id:'x',conceptId:'sem:event.cook',parts:[{path:[null]}]},
  {id:'x',conceptId:'sem:event.cook',parts:[{formKeyFrom:{path:17,featureId:'number',values:{},default:'citation'}}]},
  {id:'x',conceptId:'sem:event.cook',parts:[{embeddedPath:[null]}]},
 ]){
  const result=reg.get('analysis.realize-template').evaluate({state:createRuntimeState(graph),resources}, {value:[event]}, {patterns:[malformed]});
  assert.deepEqual(result.outputs.value,[]);
  assert.equal(result.diagnostics[0].code,'INVALID_GENERATION_PATTERNS');
 }
});
