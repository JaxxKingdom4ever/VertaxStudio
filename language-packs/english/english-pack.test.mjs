import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, toAnalyzerProject, toCompilerProject } from '../../dist/packages/project-model/src/index.js';
import { NodeRegistry } from '../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../dist/packages/primitives/src/index.js';
import { analyzeSurface,compileMeaningGraph } from '../../dist/packages/compiler/src/index.js';
const root='language-packs/english.vertax';
const options={mode:'trace',maxStepsPerStage:100};
const registry=new NodeRegistry();registerCorePrimitives(registry);
let loaded;
async function project(){loaded??=await loadProject(root);assert.deepEqual(loaded.diagnostics.filter(x=>x.severity==='Error'),[]);assert.ok(loaded.project);return loaded.project;}
test('English ships as a readable schema-2 language pack with at least 500 real lexemes',async()=>{
 const p=await project();assert.equal(p.manifest.schema_version,2);assert.equal(p.manifest.language.tag,'en');assert.deepEqual([...p.manifest.language.capabilities].sort(),['analyze','generate']);
 assert.ok(Object.keys(p.lexemes).length>=500);
 assert.equal(p.lexemes['lex:en:take:verb'].forms.past,'took');
 assert.equal(p.lexemes['lex:en:go:verb'].forms.participle,'gone');
 assert.equal(p.lexemes['lex:en:cook:verb'].forms.past,'cooked');
});
test('English uses persisted generic stages to analyze and generate a transitive sentence',async()=>{
 const p=await project();const ap=toAnalyzerProject(p),cp=toCompilerProject(p);
 assert.ok(ap.project);assert.ok(cp.project);
 const a=analyzeSurface(ap.project,registry,'The person cooks the food.',options);
 assert.equal(a.success,true,JSON.stringify(a.diagnostics));assert.equal(a.candidates.length,1);
 const meaning=a.candidates[0].meaning;assert.equal(meaning.objects.event.conceptId,'sem:event.cook');assert.equal(meaning.objects.person.conceptId,'sem:entity.person');
 const output=compileMeaningGraph(cp.project,registry,meaning,options);
 assert.equal(output.success,true,JSON.stringify(output.diagnostics));assert.equal(output.surface,'The person cooks the food.');
});
test('English telescope PP remains two distinct structural interpretations',async()=>{
 const p=await project();const a=analyzeSurface(toAnalyzerProject(p).project,registry,'I saw the man with the telescope.',options);
 assert.equal(a.success,true,JSON.stringify(a.diagnostics));assert.equal(a.candidates.length,2);assert.notEqual(a.candidates[0].id,a.candidates[1].id);
});
test('unknown English token never silently substitutes a known word',async()=>{
 const p=await project();const a=analyzeSurface(toAnalyzerProject(p).project,registry,'The person flibbertigibbets the food.',options);
 assert.equal(a.success,false);assert.equal(a.candidates.length,0);assert.ok(a.diagnostics.some(d=>d.code==='NO_ANALYSIS_CANDIDATES'));
});
test('productive transitive grammar handles unseen noun/verb combinations from persisted lexicon',async()=>{
 const p=await project();const analyzer=toAnalyzerProject(p).project;const compiler=toCompilerProject(p).project;
 for(const [sentence,concept] of [['The dog sees the cat.','sem:event.see'],['The woman found the book.','sem:event.find'],['The child built the house.','sem:event.build']]){
  const a=analyzeSurface(analyzer,registry,sentence,options);
  assert.equal(a.success,true,`${sentence}: ${JSON.stringify(a.diagnostics)}`);assert.equal(a.candidates.length,1,sentence);
  assert.equal(a.candidates[0].meaning.objects.event.conceptId,concept);
  const output=compileMeaningGraph(compiler,registry,a.candidates[0].meaning,options);
  assert.equal(output.success,true,`${sentence}: ${JSON.stringify(output.diagnostics)}`);assert.equal(output.surface,sentence);
 }
});
test('unsupported plural agreement does not silently collapse plural nouns into singular meaning',async()=>{
 const p=await project();const a=analyzeSurface(toAnalyzerProject(p).project,registry,'The people cooks the food.',options);
 assert.equal(a.success,false);assert.equal(a.candidates.length,0);
 assert.ok(a.diagnostics.some(d=>d.code==='NO_ANALYSIS_CANDIDATES'));
});
test('the common syncretic regular past form remains both past and participle until syntax resolves',async()=>{
 const p=await project();const reg=registry;
 const source={valueType:'SourceText',id:'s',text:'cooked'};
 const lex=reg.get('analysis.lexeme-lookup').evaluate({state:{semanticGraph:{objects:{},roots:[]},scopes:{},requirements:{},currentScopeId:'x'},resources:{lexemes:p.lexemes}}, {value:[reg.get('analysis.tokenize').evaluate({state:{}},{value:[source]},{}).outputs.value[0]]},{});
 const opts=lex.outputs.value[0].tokens[0].options.filter(x=>x.lexemeId==='lex:en:cook:verb').map(x=>x.formKey);
 assert.deepEqual(opts.sort(),['participle','past']);
});
test('plural agreement survives English analysis and generation as an explicit meaning feature',async()=>{
 const p=await project();const analyzer=toAnalyzerProject(p).project;const compiler=toCompilerProject(p).project;
 const sentence='The people cook the food.';
 const a=analyzeSurface(analyzer,registry,sentence,options);
 assert.equal(a.success,true,JSON.stringify(a.diagnostics));assert.equal(a.candidates.length,1);
 assert.equal(a.candidates[0].meaning.objects.person.features.values.number,'plural');
 const output=compileMeaningGraph(compiler,registry,a.candidates[0].meaning,options);
 assert.equal(output.success,true,JSON.stringify(output.diagnostics));assert.equal(output.surface,sentence);
});
test('high-frequency irregular and doubled-final forms are not naively regularized',async()=>{
 const p=await project();const expected={
  let:['let','let'],tell:['told','told'],put:['put','put'],understand:['understood','understood'],
  become:['became','become'],read:['read','read'],cut:['cut','cut'],hear:['heard','heard'],
  meet:['met','met'],feel:['felt','felt'],keep:['kept','kept'],lead:['led','led'],
  pay:['paid','paid'],hold:['held','held'],sleep:['slept','slept'],occur:['occurred','occurred'],don:['donned','donned']
 };
 for(const [word,[past,participle]] of Object.entries(expected)){
  assert.equal(p.lexemes[`lex:en:${word}:verb`]?.forms.past,past,`${word} past`);
  assert.equal(p.lexemes[`lex:en:${word}:verb`]?.forms.participle,participle,`${word} participle`);
 }
});
