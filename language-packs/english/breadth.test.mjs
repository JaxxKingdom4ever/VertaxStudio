import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,toAnalyzerProject,toCompilerProject} from '../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../dist/packages/primitives/src/index.js';
import {analyzeSurface,compileMeaningGraph} from '../../dist/packages/compiler/src/index.js';

const cases=[
  {family:'future',text:'The girl will cook the food.',tense:'future'},
  {family:'progressive',text:'The girl is cooking the food.',aspect:'progressive'},
  {family:'plural-progressive',text:'The girls are cooking the food.',aspect:'progressive',agentNumber:'plural'},
  {family:'perfect',text:'The girl has cooked the food.',aspect:'perfect'},
  {family:'negation',text:'The girl does not cook the food.',polarity:'negative'},
  {family:'past-negation',text:'The girl did not cook the food.',tense:'past',polarity:'negative'},
  {family:'question',text:'Does the girl cook the food?',question:'yesno'},
  {family:'past-question',text:'Did the girl cook the food?',tense:'past',question:'yesno'},
  {family:'ditransitive',text:'The girl gave the boy the book.',tense:'past',recipient:'sem:entity.boy'},
  {family:'passive',text:'The food was cooked by the girl.',tense:'past',voice:'passive'},
  {family:'locative',text:'The girl cooked the food in the house.',tense:'past',location:'sem:entity.house'},
  {family:'copula',text:'The girl is happy.',kind:'State',attribute:'sem:property.happy'},
  {family:'attributive-modifier',text:'The happy girl cooked the food.',tense:'past',attribute:'sem:property.happy'},
  {family:'coordination',text:'The girl and the boy cook the food.',tense:'present',agentNumber:'plural',kindAgent:'Group'},
  {family:'pronoun',text:'She cooked the food.',tense:'past',agent:'sem:entity.she'},
  {family:'modal',text:'The girl can cook the food.',modality:'ability'},
  {family:'wh-question',text:'What does the girl cook?',question:'wh',themeKind:'Unknown'},
  {family:'possessive',text:"The girl's book is red.",kind:'State',subject:'sem:entity.book',attribute:'sem:property.red',possessor:'sem:entity.girl'},
  {family:'plural-possessive',text:"The girls' book is red.",kind:'State',subject:'sem:entity.book',attribute:'sem:property.red',possessor:'sem:entity.girl',possessorNumber:'plural'},
  {family:'comparative',text:'The boy is taller than the girl.',kind:'State',subject:'sem:entity.boy',attribute:'sem:property.tall',comparison:'sem:entity.girl',degree:'comparative'},
  {family:'superlative',text:'The girl is the tallest.',kind:'State',subject:'sem:entity.girl',attribute:'sem:property.tall',degree:'superlative'},
  {family:'adverbial',text:'The girl quickly cooked the food.',tense:'past',manner:'sem:property.quickly'},
  {family:'complement',text:'The girl said that the boy cooked the food.',tense:'past',complement:'sem:event.cook'},
  {family:'relative',text:'The girl who cooked the food saw the boy.',tense:'past',relative:'sem:event.cook'},
  {family:'past-perfect',text:'The girl had cooked the food.',tense:'past',aspect:'perfect'},
  {family:'future-perfect',text:'The girl will have cooked the food.',tense:'future',aspect:'perfect'},
  {family:'perfect-progressive',text:'The girl has been cooking the food.',tense:'present',aspect:'perfect-progressive'},
  {family:'indefinite-determiner',text:'A girl cooked the food.',tense:'past',definiteness:'indefinite'},
  {family:'pronoun-he',text:'He cooked the food.',tense:'past',agent:'sem:entity.he'},
  {family:'pronoun-they',text:'They cook the food.',tense:'present',agent:'sem:entity.they',agentNumber:'plural'}
];
const registry=new NodeRegistry();registerCorePrimitives(registry);
const options={mode:'trace',maxStepsPerStage:250};
let loaded;
async function getPack(){loaded??=await loadProject('language-packs/english.vertax');assert.ok(loaded.project,JSON.stringify(loaded.diagnostics));return loaded.project;}
function first(graph,root,role){return graph.objects[root.roles[role]?.[0]];}
for(const c of cases){
  test(`real persisted English pack analyzes and regenerates ${c.family}`,async()=>{
    const pack=await getPack();
    const a=analyzeSurface(toAnalyzerProject(pack).project,registry,c.text,options);
    assert.equal(a.success,true,`${c.text}: ${JSON.stringify(a.diagnostics)}`);
    assert.equal(a.candidates.length,1,`${c.text}: ${JSON.stringify(a.candidates.map(x=>x.id))}`);
    const graph=a.candidates[0].meaning, root=graph.objects[graph.roots[0]];
    assert.equal(root.type,c.kind??'Event');
    for(const feature of ['tense','aspect','polarity','voice','question','modality','degree'])if(c[feature])assert.equal(root.features.values[feature],c[feature],c.text);
    if(c.agent)assert.equal(first(graph,root,'agent').conceptId,c.agent);
    if(c.agentNumber)assert.equal(first(graph,root,'agent').features.values.number,c.agentNumber);
    if(c.kindAgent)assert.equal(first(graph,root,'agent').type,c.kindAgent);
    if(c.recipient)assert.equal(first(graph,root,'recipient').conceptId,c.recipient);
    if(c.location)assert.equal(first(graph,root,'location').conceptId,c.location);
    if(c.attribute){const target=root.type==='State'?root:first(graph,root,'agent');assert.equal(first(graph,target,'quality').conceptId,c.attribute);}
    if(c.subject)assert.equal(first(graph,root,'subject').conceptId,c.subject);
    if(c.possessor){const possessor=first(graph,first(graph,root,'subject'),'possessor');assert.equal(possessor?.conceptId,c.possessor);if(c.possessorNumber)assert.equal(possessor.features.values.number,c.possessorNumber);}
    if(c.comparison)assert.equal(first(graph,root,'comparison').conceptId,c.comparison);
    if(c.manner)assert.equal(first(graph,root,'manner').conceptId,c.manner);
    if(c.complement)assert.equal(first(graph,root,'complement').conceptId,c.complement);
    if(c.relative){const agent=first(graph,root,'agent'),relative=first(graph,agent,'relative');assert.equal(relative.conceptId,c.relative);assert.equal(relative.roles.agent[0],agent.id);}
    if(c.definiteness)assert.equal(first(graph,root,'agent').features.values.definiteness,c.definiteness);
    if(c.themeKind)assert.equal(first(graph,root,'theme').type,c.themeKind);
    const g=compileMeaningGraph(toCompilerProject(pack).project,registry,graph,options);
    assert.equal(g.success,true,`${c.text}: ${JSON.stringify(g.diagnostics)}`);
    assert.equal(g.surface,c.text);
  });
}
test('unsupported argument frames do not guess a semantic recipient for a verb with incompatible valency',async()=>{
 const pack=await getPack();
 const a=analyzeSurface(toAnalyzerProject(pack).project,registry,'The girl saw the boy the book.',options);
 assert.equal(a.success,false,JSON.stringify(a.candidates));
 assert.equal(a.candidates.length,0);
});
