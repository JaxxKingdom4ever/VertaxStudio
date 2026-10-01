import test from 'node:test';
import assert from 'node:assert/strict';
import {composeSyntaxPatterns,makeMeaning,tokenizeText,lexicalizeTokens,matchSyntaxPatterns} from '../../../dist/packages/primitives/src/index.js';
import {semanticFingerprint} from '../../../dist/packages/compiler/src/index.js';
const entry=(id,conceptId,lexicalClass,forms)=>({id,conceptId,lexicalClass,forms,features:{values:{}},valency:[],relatedLexemes:{},irregularRuleIds:[],metadata:{}});
const resources={lexemes:{
  girl:entry('girl','sem:entity.girl','Noun',{citation:'girl'}), boy:entry('boy','sem:entity.boy','Noun',{citation:'boy'}),
  telescope:entry('telescope','sem:entity.telescope','Noun',{citation:'telescope'}),
  happy:entry('happy','sem:property.happy','Adjective',{citation:'happy'}),small:entry('small','sem:property.small','Adjective',{citation:'small'}),
  see:entry('see','sem:event.see','Verb',{citation:'see',past:'saw'}),
  read:entry('read','sem:event.read','Verb',{citation:'read',past:'read'}),
  the:entry('the','sem:function.the','Determiner',{citation:'the'}),
  with:entry('with','sem:function.with','Preposition',{citation:'with'})
 },concepts:{},tables:{},featureDefinitions:{},conceptToLexemeIds:{}};
const grammar={startSymbol:'S',rules:[
 {id:'nom-noun',lhs:'NOM',rhs:[{terminal:{classes:['Noun']}}],head:0,meaning:{root:'entity',objects:[{id:'entity',type:'Entity',slot:0}]}},
 {id:'nom-adj',lhs:'NOM',rhs:[{terminal:{classes:['Adjective']}},{category:'NOM'}],head:1,meaning:{root:'$1',objects:[{id:'qual',type:'Property',slot:0}],augmentRoles:[{target:'$1',role:'quality',value:'qual'}]}},
 {id:'np-def',lhs:'NP',rhs:[{terminal:{text:'the'}},{category:'NOM'}],head:1,meaning:{root:'$1',objects:[],augmentFeatures:[{target:'$1',values:{definiteness:'definite'}}]}},
 {id:'pp-with',lhs:'WITH_PP',rhs:[{terminal:{text:'with'}},{category:'NP'}],head:1,meaning:{root:'$1',objects:[]}},
 {id:'nom-with',lhs:'NOM',rhs:[{category:'NOM'},{category:'WITH_PP'}],head:0,meaning:{root:'$0',objects:[],augmentRoles:[{target:'$0',role:'association',value:'$1'}]}},
 {id:'vp-see',lhs:'VP',rhs:[{terminal:{classes:['Verb'],formKeys:['past']}},{category:'NP'}],head:0,meaning:{root:'event',objects:[{id:'event',type:'Event',slot:0,roles:{theme:['$1']},features:{tense:'past'}}]}},
 {id:'vp-with',lhs:'VP',rhs:[{category:'VP'},{category:'WITH_PP'}],head:0,meaning:{root:'$0',objects:[],augmentRoles:[{target:'$0',role:'instrument',value:'$1'}]}},
 {id:'sentence',lhs:'S',rhs:[{category:'NP'},{category:'VP'},{terminal:{text:'.'}}],head:1,meaning:{root:'$1',objects:[],augmentRoles:[{target:'$1',role:'agent',value:'$0'}]}}
 ]};
const parse=(source,g=grammar)=>composeSyntaxPatterns(lexicalizeTokens(tokenizeText({valueType:'SourceText',id:'src',text:source}),resources).value,g);
const graphs=source=>{const out=parse(source);assert.deepEqual(out.diagnostics,[]);return out.analyses.map(s=>{const m=makeMeaning(s);assert.deepEqual(m.diagnostics,[]);return m.value.graph;});};
test('reusable adjective and noun phrases compose into nested semantic graph without fixed whole-sentence slots',()=>{
 const meanings=graphs('The happy small girl saw the boy.');assert.equal(meanings.length,1);
 const g=meanings[0],e=g.objects[g.roots[0]],agent=g.objects[e.roles.agent[0]];
 assert.equal(e.conceptId,'sem:event.see');assert.equal(g.objects[e.roles.theme[0]].conceptId,'sem:entity.boy');
 assert.deepEqual(agent.roles.quality.map(id=>g.objects[id].conceptId),['sem:property.small','sem:property.happy']);
 assert.equal(agent.features.values.definiteness,'definite');
});
test('attachment ambiguity follows from two reusable rules without sentence-specific grammar',()=>{
 const meanings=graphs('The girl saw the boy with the telescope.');assert.equal(meanings.length,2);
 assert.equal(meanings.filter(g=>g.objects[g.roots[0]].roles.instrument?.length===1).length,1);
 assert.equal(meanings.filter(g=>g.objects[g.objects[g.objects[g.roots[0]].roles.theme[0]].id].roles.association?.length===1).length,1);
});
test('recursive noun modification combines with both attachment alternatives',()=>{
 const meanings=graphs('The happy girl saw the small boy with the telescope.');
 // Two syntactic derivations can build the same semantic attachment. The
 // public analyzer deduplicates these by structural meaning, not syntax ID.
 assert.equal(new Set(meanings.map(semanticFingerprint)).size,2);
 for(const graph of meanings){const e=graph.objects[graph.roots[0]],person=graph.objects[e.roles.agent[0]];
  assert.equal(graph.objects[person.roles.quality[0]].conceptId,'sem:property.happy');}
});
test('unary nonterminal cycles are rejected rather than spinning or truncating',()=>{
 const r=parse('The girl saw the boy.',{...grammar,rules:[...grammar.rules,{id:'self',lhs:'NOM',rhs:[{category:'NOM'}],meaning:{root:'$0',objects:[]}}]});
 assert.equal(r.analyses.length,0);assert.ok(r.diagnostics.some(d=>d.code==='ANALYSIS_GRAMMAR_CYCLE'));
});
test('candidate limits fail explicitly rather than silently dropping a meaning',()=>{
 const r=parse('The girl saw the boy with the telescope.',{...grammar,maxResults:1});
 assert.equal(r.analyses.length,0);assert.ok(r.diagnostics.some(d=>d.code==='ANALYSIS_PARSE_BUDGET'));
});
test('lexical ambiguity is not collapsed to a first matching form key in legacy patterns',()=>{
 const morph=lexicalizeTokens(tokenizeText({valueType:'SourceText',id:'r',text:'read'}),resources).value;
 const patterns=[{id:'verb-ambiguous',slots:[{classes:['Verb'],formKeys:['citation','past']}],meaning:{root:'event',objects:[{id:'event',type:'Event',slot:0}]}}];
 const analyses=matchSyntaxPatterns(morph,patterns);
 assert.equal(analyses.length,2);
 assert.deepEqual(analyses.map(a=>a.nodes.event.captures['0'].formKey).sort(),['citation','past']);
});
test('legacy flat patterns fail closed on combinatorial lexical ambiguity instead of silently picking one or hanging',async()=>{
 const {registerAnalysisPrimitives}=await import('../../../dist/packages/primitives/src/index.js');
 const {NodeRegistry,createRuntimeState}=await import('../../../dist/packages/runtime/src/index.js');
 const options=[0,1,2].map(i=>({lexemeId:`v${i}`,conceptId:'sem:event.read',lexicalClass:'Verb',formKey:`variant${i}`}));
 const analyzed={valueType:'MorphAnalysis',id:'many',features:{values:{}},tokens:Array.from({length:8},(_,i)=>({token:{id:`tok:${i}`,text:'read',normalized:'read',start:i*5,end:i*5+4},options}))};
 const pattern={id:'many-readings',slots:Array.from({length:8},()=>({classes:['Verb']})),meaning:{root:'event',objects:[{id:'event',type:'Event',slot:0}]}};
 assert.throws(()=>matchSyntaxPatterns(analyzed,[pattern]),/budget|limit/i);
 const registry=new NodeRegistry();registerAnalysisPrimitives(registry);
 const result=registry.get('analysis.match-pattern').evaluate({state:createRuntimeState({roots:[],objects:{}})}, {value:[analyzed]}, {patterns:[pattern]});
 assert.deepEqual(result.outputs.value,[]);assert.ok(result.diagnostics.some(d=>d.code==='ANALYSIS_PARSE_BUDGET'));
});
