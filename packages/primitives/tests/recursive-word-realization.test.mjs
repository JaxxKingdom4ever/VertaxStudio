import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRegistry, executeGraph, createRuntimeState } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';

const object=(id,type,conceptId,roles={})=>({id,type,conceptId,roles,features:{values:{}}});
const lexeme=(conceptId,form)=>({id:`lex:${conceptId}`,conceptId,lexicalClass:'Any',forms:{citation:form},features:{values:{}},valency:[],relatedLexemes:{},irregularRuleIds:[],metadata:{}});
const dict=[['person','person'],['book','book'],['food','food'],['cook','cook'],['need','need'],['say','say'],['and','and'],['possession','lez']].map(([name,form])=>lexeme(`sem:${name}`,form));
const resources={lexemes:Object.fromEntries(dict.map(l=>[l.id,l])),conceptToLexemeIds:Object.fromEntries(dict.map(l=>[l.conceptId,[l.id]])),concepts:{},tables:{},featureDefinitions:{}};
const root={root:true};const role=name=>({role:name});const con=name=>({conceptId:`sem:${name}`});
const patterns=[
 {id:'cook',conceptId:'sem:cook',requiredRoles:['agent','theme'],words:[[role('agent')],[root],{expandRole:'theme'}]},
 {id:'need',conceptId:'sem:need',requiredRoles:['agent','complement'],words:[[role('agent')],[root],{expandRole:'complement'}]},
 {id:'say',conceptId:'sem:say',requiredRoles:['agent','complement'],words:[[role('agent')],[root],{expandRole:'complement'}]},
 {id:'possession',conceptId:'*',requiredRoles:['possessor'],words:[{expandRole:'possessor',suffix:[{...con('possession'),kind:'Suffix',joinBefore:"'"}]},[root]]},
 {id:'coordinate',conceptId:'sem:and',requiredRoles:['items'],words:[{expandRole:'items',separatorWords:[[con('and')]]}]}
];
function execute(objects,rootId,custom=patterns){
 const registry=new NodeRegistry();registerCorePrimitives(registry);
 const graph={id:'recursive',nodes:[{id:'realize',typeId:'grammar.realize-words',params:{patterns:custom}}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'realize',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'realize',nodePortId:'value'}]};
 const state=createRuntimeState({roots:[rootId],objects});
 const grammar=executeGraph(graph,registry,{state,resources},{value:[objects[rootId]]});
 if(grammar.diagnostics.length)return {grammar};
 const words=grammar.outputs.value.map(candidate=>{
   const m=executeGraph({id:'m',nodes:[{id:'n',typeId:'morph.lexical',params:{}}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}]},registry,{state,resources},{value:[candidate]});
   assert.deepEqual(m.diagnostics,[]);
   return m.outputs.value[0].morphs.filter(x=>x.kind!=='Zero').map((m,i)=>(i?m.boundaryBefore??'':'')+m.form).join('');
 });
 return {grammar,words};
}
const base={a:object('a','Entity','sem:person'),f:object('f','Entity','sem:food'),cook:object('cook','Event','sem:cook',{agent:['a'],theme:['f']})};

test('nested complement events are recursively realized in semantic order and provenance is retained',()=>{
 const objects={...base,need:object('need','Event','sem:need',{agent:['a'],complement:['cook']}),say:object('say','Event','sem:say',{agent:['a'],complement:['need']})};
 const {grammar,words}=execute(objects,'say');
 assert.deepEqual(grammar.diagnostics,[]);
 assert.equal(words.join(' '),'person say person need person cook food');
 assert.equal(grammar.outputs.value.filter(x=>x.data.segments.some(s=>s.sourceId==='cook')).length,1);
 assert.equal(new Set(grammar.outputs.value.map(v=>v.id)).size,grammar.outputs.value.length);
});

test('recursively possessed noun referents attach a project-authored marker at every depth',()=>{
 const objects={...base,b1:object('b1','Entity','sem:book',{possessor:['a']}),b2:object('b2','Entity','sem:book',{possessor:['b1']}),b3:object('b3','Entity','sem:book',{possessor:['b2']}),cook:object('cook','Event','sem:cook',{agent:['a'],theme:['b3']})};
 const {grammar,words}=execute(objects,'cook');
 assert.deepEqual(grammar.diagnostics,[]);
 assert.equal(words.join(' '),"person cook person'lez book'lez book'lez book");
 assert.deepEqual(grammar.outputs.value.filter(v=>v.data.segments.some(s=>s.lexemeId==='lex:sem:possession')).length,3);
});

test('authored variadic role expansion places separators between all members, not after the last',()=>{
 const objects={...base,c1:object('c1','Event','sem:cook',{agent:['a'],theme:['f']}),c2:object('c2','Event','sem:cook',{agent:['a'],theme:['f']}),c3:object('c3','Event','sem:cook',{agent:['a'],theme:['f']}),and:object('and','Relation','sem:and',{items:['c1','c2','c3']})};
 const {grammar,words}=execute(objects,'and');
 assert.deepEqual(grammar.diagnostics,[]);
 assert.equal(words.join(' '),'person cook food and person cook food and person cook food');
 assert.equal(words.filter(w=>w==='and').length,2);
});

test('cycles in nested semantic references return structured diagnostics',()=>{
 const objects={loop:object('loop','Entity','sem:book',{possessor:['loop']})};
 const {grammar}=execute(objects,'loop');
 assert.equal(grammar.outputs.value.length,0);
 assert.ok(grammar.diagnostics.some(d=>d.code==='RECURSIVE_WORD_EXPANSION'));
});

test('unrealizable nested objects fail instead of silently dropping a clause or falling back to a leaf lexeme',()=>{
 const objects={...base,missing:object('missing','Event','sem:unknown'),need:object('need','Event','sem:need',{agent:['a'],complement:['missing']})};
 const {grammar}=execute(objects,'need');
 assert.equal(grammar.outputs.value.length,0);
 assert.ok(grammar.diagnostics.some(d=>d.code==='UNSUPPORTED_SEMANTIC_PATTERN'));
});

test('malformed recursive word expansion configuration returns validation diagnostics',()=>{
 const invalid=[...patterns,{id:'invalid',conceptId:'sem:need',words:[{expandRole:'complement',suffix:[{role:'agent',root:true}]}]}];
 const {grammar}=execute({...base,need:object('need','Event','sem:need',{agent:['a'],complement:['cook']})},'need',invalid);
 assert.ok(grammar.diagnostics.some(d=>d.code==='INVALID_WORD_PATTERNS'));
});

test('authored nested scope calls resolve typed requirements deepest-first and return to the caller scope',()=>{
 const scoped=patterns.map(p=>p.id==='say'||p.id==='need'?{...p,words:p.words.map(w=>w.expandRole==='complement'?{...w,scopeType:'Complement',acceptedTypes:['Event']}:w)}:p);
 const objects={...base,need:object('need','Event','sem:need',{agent:['a'],complement:['cook']}),say:object('say','Event','sem:say',{agent:['a'],complement:['need']})};
 const {grammar,words}=execute(objects,'say',scoped);
 assert.deepEqual(grammar.diagnostics,[]);
 assert.equal(words.join(' '),'person say person need person cook food');
 const scopes=Object.values(grammar.state.scopes).filter(s=>s.type==='Complement');
 assert.equal(scopes.length,2);
 assert.ok(scopes.every(s=>s.status==='RESOLVED'));
 assert.equal(scopes.find(s=>s.parentId==='scope:root')?.childIds.length,1);
 assert.equal(grammar.state.currentScopeId,'scope:root');
 const requirements=Object.values(grammar.state.requirements);
 assert.equal(requirements.length,2);
 assert.ok(requirements.every(r=>r.status==='RESOLVED'));
 assert.deepEqual(new Set(requirements.map(r=>r.resolutionId)),new Set(['need','cook']));
});

test('a typed scope call rejects a wrong semantic role target without emitting partial words',()=>{
 const scoped=patterns.map(p=>p.id==='need'?{...p,words:p.words.map(w=>w.expandRole==='complement'?{...w,scopeType:'Complement',acceptedTypes:['Event']}:w)}:p);
 const objects={...base,need:object('need','Event','sem:need',{agent:['a'],complement:['f']})};
 const {grammar}=execute(objects,'need',scoped);
 assert.equal(grammar.outputs.value.length,0);
 assert.ok(grammar.diagnostics.some(d=>d.code==='REQUIREMENT_TYPE_MISMATCH'),JSON.stringify(grammar.diagnostics));
});

test('flat lexical role fragments cannot discard nested semantic roles without an explicit expansion',()=>{
 const owned=object('owned','Entity','sem:book',{possessor:['a']});
 const objects={...base,owned,cook:object('cook','Event','sem:cook',{agent:['a'],theme:['owned']})};
 const flat=[{id:'flat',conceptId:'sem:cook',requiredRoles:['agent','theme'],words:[[role('agent')],[root],[role('theme')]]}];
 const {grammar}=execute(objects,'cook',flat);
 assert.equal(grammar.outputs.value.length,0);
 assert.ok(grammar.diagnostics.some(d=>d.code==='UNEXPANDED_SEMANTIC_ROLE'),JSON.stringify(grammar.diagnostics));
});

test('flat role fragments cannot discard extra siblings in a many-valued semantic role',()=>{
 const objects={...base,other:object('other','Entity','sem:book'),cook:object('cook','Event','sem:cook',{agent:['a'],theme:['f','other']})};
 const flat=[{id:'flat',conceptId:'sem:cook',requiredRoles:['agent','theme'],words:[[role('agent')],[root],[role('theme')]]}];
 const {grammar}=execute(objects,'cook',flat);
 assert.equal(grammar.outputs.value.length,0);
 assert.ok(grammar.diagnostics.some(d=>d.code==='UNEXPANDED_SEMANTIC_ROLE'),JSON.stringify(grammar.diagnostics));
});

test('project-authored root-type constraints prevent noun possession rules from matching events',()=>{
 const nounOnly=patterns.map(p=>p.id==='possession'?{...p,valueTypes:['Entity','Reference']}:p);
 const objects={...base,wrong:object('wrong','Event','sem:cook',{possessor:['a']})};
 const {grammar}=execute(objects,'wrong',nounOnly);
 assert.equal(grammar.outputs.value.length,0);
 assert.ok(grammar.diagnostics.some(d=>d.code==='UNSUPPORTED_SEMANTIC_PATTERN'),JSON.stringify(grammar.diagnostics));
});

test('a narrower authored root type outranks an otherwise identical unconstrained pattern',()=>{
 const objects={root:object('root','Relation','sem:and')};
 const competing=[
  {id:'wide',conceptId:'sem:and',words:[[con('and')]]},
  {id:'narrow',conceptId:'sem:and',valueTypes:['Relation'],words:[[con('need')]]}
 ];
 const {grammar,words}=execute(objects,'root',competing);
 assert.deepEqual(grammar.diagnostics,[]);
 assert.deepEqual(words,['need']);
});

test('project-authored role expansion can require semantic feature values before opening a typed child scope',()=>{
 const protectedPatterns=patterns.map(p=>p.id==='need'?{
   ...p,words:p.words.map(w=>w.expandRole==='complement'?{
     ...w,scopeType:'Complement',acceptedTypes:['Event'],requiredFeatures:{clause:'finite'}
   }:w)
 }:p);
 const objects={...base,need:object('need','Event','sem:need',{agent:['a'],complement:['cook']})};
 const bad=execute(objects,'need',protectedPatterns).grammar;
 assert.ok(bad.diagnostics.some(d=>d.code==='REQUIREMENT_FEATURE_MISMATCH'),JSON.stringify(bad.diagnostics));
 assert.equal(bad.outputs.value.length,0);
 const marked={...objects,cook:{...objects.cook,features:{values:{clause:'finite'}}}};
 const good=execute(marked,'need',protectedPatterns);
 assert.deepEqual(good.grammar.diagnostics,[]);
 assert.equal(good.words.join(' '),'person need person cook food');
});

test('a project-authored tail prefix can reference another semantic role without an extra requiredRoles declaration',()=>{
 const patterns=[{id:'role-bound-tail',conceptId:'sem:and',words:[
   {expandRole:'items',minItems:2,prefix:[role('connector')],prefixBoundary:"'"}
 ]}];
 const objects={a:object('a','Entity','sem:person'),f:object('f','Entity','sem:food'),
   and:object('and','SemanticList','sem:and',{items:['a','f'],connector:['f']})};
 const result=execute(objects,'and',patterns);
 assert.deepEqual(result.grammar.diagnostics,[]);
 assert.equal(result.words.join(' '),"person food'food");
});
