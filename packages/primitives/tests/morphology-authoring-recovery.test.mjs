import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRegistry, createRuntimeState, executeGraph } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives, rootMorph, zeroMorph } from '../../../dist/packages/primitives/src/index.js';

const registry = new NodeRegistry();
registerCorePrimitives(registry);
const features = values => ({ values });
const root = (form='cat', values={number:'singular'}) => ({...rootMorph(form), id:'root:original', sourceObjectId:'object:cat', sourceIds:['meaning:cat'], features:features(values)});
const seq = (...morphs) => ({id:'sequence:1',morphs});
const object = (id,values) => ({id,type:'Entity',conceptId:'sem:entity.person',roles:{},features:features(values)});
const state = createRuntimeState({roots:[],objects:{}});
function run(type,value,params={},controller,resources) {
  const definition=registry.get(type);
  assert.ok(definition,`Registered node ${type}`);
  const bindings=[{graphPortId:'value',nodeId:'node:active',nodePortId:'value'}];
  const inputs={value:[value]};
  if(controller!==undefined){bindings.push({graphPortId:'controller',nodeId:'node:active',nodePortId:'controller'});inputs.controller=[controller]}
  const graph={id:'graph:morph',nodes:[{id:'node:active',typeId:type,params}],edges:[],exposedInputs:bindings,exposedOutputs:[{graphPortId:'value',nodeId:'node:active',nodePortId:'value'}]};
  return executeGraph(graph,registry,{state,resources},{...inputs});
}
function morph(type,value,params={},controller,resources){
  const result=run(type,value,params,controller,resources);
  assert.deepEqual(result.diagnostics,[],`${type} diagnostics: ${JSON.stringify(result.diagnostics)}`);
  assert.equal(result.outputs.value.length,1);
  return result.outputs.value[0];
}
const forms = value => value.morphs.map(x=>x.kind==='Zero'?'∅':x.form);

test('full generic morphology authoring catalog is executable, not placeholder metadata',()=>{
  for(const name of ['root','affix','prefix','suffix','circumfix','zero','select-allomorph','order','fuse','reduplicate','mutate','agreement']){
    const d=registry.get(`morph.${name}`);assert.ok(d,`missing morph.${name}`);
    assert.equal(d.outputs[0].acceptedTypes[0],'MorphSequence');
  }
});

test('root copies candidate features and source identity; zero remains inspectable',()=>{
  const candidate={id:'candidate:1',kind:'MorphCandidate',children:[],features:features({tense:'present'}),data:{form:'dance',sourceObjectId:'event:dance'}};
  const result=morph('morph.root',candidate);
  assert.equal(result.morphs[0].form,'dance');
  assert.equal(result.morphs[0].features.values.tense,'present');
  assert.equal(result.morphs[0].sourceObjectId,'event:dance');
  const zero=morph('morph.zero',result,{featureId:'present'});
  assert.equal(zero.morphs[1].kind,'Zero');
  assert.equal(zero.morphs[1].featureId,'present');
  assert.deepEqual(forms(zero),['dance','∅']);
  assert.equal(forms(result).join(''),'dance');
});

test('affix and circumfix author independent abstract morphs with shared origin',()=>{
  const base=seq(root());
  const p=morph('morph.affix',base,{form:'un',position:'Prefix',sourceObjectId:'meaning:negative'});
  assert.deepEqual(forms(p),['un','cat']);
  assert.equal(p.morphs[0].position,'Prefix');
  assert.equal(p.morphs[0].sourceObjectId,'meaning:negative');
  const around=morph('morph.circumfix',base,{prefix:'ge',suffix:'t',sourceObjectId:'meaning:perfect'});
  assert.deepEqual(forms(around),['ge','cat','t']);
  assert.equal(around.morphs[0].pairId,around.morphs[2].pairId);
  assert.equal(around.morphs[0].sourceObjectId,around.morphs[2].sourceObjectId);
  assert.deepEqual(forms(base),['cat']);
});

test('allomorphs prefer specificity, then numeric priority, then non-fallback',()=>{
  const base=seq(root('go',{tense:'past',number:'plural'}));
  const candidates=[
    {form:'general',priority:999},
    {form:'specific-low',when:{tense:'past'}},
    {form:'specific-high',when:{tense:'past'},priority:3,fallback:true},
    {form:'specific-nonfallback',when:{tense:'past'},priority:3,fallback:false},
    {form:'most-specific',when:{tense:'past',number:'plural'},priority:-5}
  ];
  assert.equal(morph('morph.select-allomorph',base,{candidates}).morphs[0].form,'most-specific');
  const candidates2=candidates.slice(0,-1);
  assert.equal(morph('morph.select-allomorph',base,{candidates:candidates2}).morphs[0].form,'specific-nonfallback');
  assert.equal(morph('morph.select-allomorph',base,{candidates:[{form:'fallback',fallback:true},{form:'chosen'}]}).morphs[0].form,'chosen');
});

test('ambiguous, absent, malformed and missing-table allomorphs diagnose instead of silently choosing',()=>{
  const base=seq(root('go',{tense:'past'}));
  assert.equal(run('morph.select-allomorph',base,{candidates:[{form:'went',when:{tense:'past'}},{form:'goed',when:{tense:'past'}}]}).diagnostics[0]?.code,'AMBIGUOUS_ALLOMORPH');
  assert.equal(run('morph.select-allomorph',base,{candidates:[{form:'goes',when:{tense:'present'}}]}).diagnostics[0]?.code,'NO_MATCHING_ALLOMORPH');
  assert.equal(run('morph.select-allomorph',base,{candidates:[{form:5}]}).diagnostics[0]?.code,'INVALID_ALLOMORPH_CANDIDATES');
  assert.equal(run('morph.select-allomorph',base,{tableId:'missing'},undefined,{tables:{}}).diagnostics[0]?.code,'MISSING_ALLOMORPH_TABLE');
});

test('data table allomorphs are facts and root morph identity is preserved',()=>{
  const base=seq(root('go',{tense:'past'}));
  const table={id:'allomorphs',label:'Allomorphs',columns:['form','when','priority'],metadata:{},rows:[{form:'went',when:{tense:'past'},priority:2},{form:'go',when:{tense:'present'}}]};
  const actual=morph('morph.select-allomorph',base,{tableId:'allomorphs'},undefined,{tables:{allomorphs:table}});
  assert.equal(actual.morphs[0].form,'went');
  assert.equal(actual.morphs[0].id,'root:original');
  assert.deepEqual(actual.morphs[0].sourceIds,['meaning:cat']);
});

test('ordering requires a strict permutation and fusion preserves all component sources',()=>{
  const base=seq(root('a'),{...rootMorph('b'),id:'root:b',sourceIds:['meaning:b']},zeroMorph('present'));
  assert.deepEqual(forms(morph('morph.order',base,{order:[2,0,1]})),['∅','a','b']);
  assert.equal(run('morph.order',base,{order:[0,0,1]}).diagnostics[0]?.code,'INVALID_MORPH_ORDER');
  const fused=morph('morph.fuse',base,{start:0,count:2,form:'ab'});
  assert.deepEqual(forms(fused),['ab','∅']);
  assert.deepEqual(new Set(fused.morphs[0].sourceIds),new Set(['meaning:cat','meaning:b','root:original','root:b','object:cat']));
  assert.deepEqual(forms(base),['a','b','∅']);
});

test('reduplication and mutation edit immutable sequences and validate parameters',()=>{
  const base=seq(root('banana'));
  assert.deepEqual(forms(morph('morph.reduplicate',base,{mode:'full',position:'Prefix'})),['banana','banana']);
  assert.deepEqual(forms(morph('morph.reduplicate',base,{mode:'partial',length:2,position:'Suffix'})),['banana','ba']);
  assert.deepEqual(forms(morph('morph.mutate',base,{from:'na',to:'xx',all:true})),['baxx xx'.replace(' ','')]);
  assert.equal(run('morph.reduplicate',base,{mode:'partial',length:-1}).diagnostics[0]?.code,'INVALID_MORPH_REPLICATION');
  assert.equal(run('morph.mutate',base,{from:'',to:'a'}).diagnostics[0]?.code,'INVALID_MORPH_MUTATION');
  assert.deepEqual(forms(base),['banana']);
});

test('agreement copies authored feature mappings from a typed controller without overwriting unrelated features',()=>{
  const base=seq(root('speak',{tense:'past',number:'singular'}));
  const controller=object('meaning:controller',{person:3,number:'plural',gender:'feminine'});
  const updated=morph('morph.agreement',base,{features:{person:'person',number:'number'}},controller);
  assert.deepEqual(updated.morphs[0].features.values,{tense:'past',number:'plural',person:3});
  assert.equal(base.morphs[0].features.values.number,'singular');
  assert.equal(run('morph.agreement',base,{features:{number:'number'}}).diagnostics[0]?.code,'MISSING_AGREEMENT_CONTROLLER');
});

test('morphology-generated sequence passes into phonology and Surface with explicit boundaries',()=>{
  const base=seq(root('cook'));
  const prefix=morph('morph.prefix',base,{form:'esi',sourceObjectId:'meaning:continuous'});
  const phon=morph('phon.from-morphs',prefix);
  assert.ok(phon.tokens.some(t=>t.kind==='Boundary'&&t.boundary==='Morpheme'));
  const spelled=morph('surface.spell',phon,{boundaries:{Morpheme:"'"}});
  assert.equal(spelled.text,"esi'cook");
  assert.ok(Object.values(spelled.sourceMap).flat().includes('meaning:continuous'));
});

test('fused and reduplicated source identities survive phonology and surface spans',()=>{
  const base=seq(root('a'),{...rootMorph('b'),id:'root:b',sourceIds:['meaning:b']});
  const fused=morph('morph.fuse',base,{form:'ab'});
  const phon=morph('phon.from-morphs',fused);
  const surface=morph('surface.spell',phon,{});
  const allIds=new Set(Object.values(surface.sourceMap??{}).flat());
  for(const sourceId of ['meaning:cat','meaning:b','root:original','root:b'])assert.ok(allIds.has(sourceId),`${sourceId} lost in fusion`);
  const red=morph('morph.reduplicate',seq(root('ka')),{mode:'partial',length:1});
  const spelling=morph('surface.spell',morph('phon.from-morphs',red),{boundaries:{Morpheme:'-'}});
  assert.equal(spelling.text,'k-ka');
  assert.ok(Object.values(spelling.sourceMap??{}).flat().includes('meaning:cat'));
});

test('empty selected allomorph is first-class zero, but blank affixes are not silent zero morphs',()=>{
 const original=seq(root('walk',{tense:'present'}));
 const present=morph('morph.select-allomorph',original,{candidates:[{form:'',when:{tense:'present'}},{form:'walk'}],featureId:'present'});
 assert.equal(present.morphs[0].kind,'Zero');
 assert.equal(present.morphs[0].featureId,'present');
 const phon=morph('phon.from-morphs',present);
 assert.deepEqual(phon.zeroMorphIds,['root:original']);
 assert.equal(morph('surface.spell',phon,{}).text,'');
 assert.equal(run('morph.affix',original,{form:'',position:'Prefix'}).diagnostics[0]?.code,'INVALID_MORPH_AFFIX');
 assert.equal(run('morph.circumfix',original,{prefix:'',suffix:'ed'}).diagnostics[0]?.code,'INVALID_MORPH_CIRCUMFIX');
});
