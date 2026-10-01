import test from 'node:test';import assert from 'node:assert/strict';
import {NodeRegistry,createRuntimeState,executeGraph} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
const port=(portId,direction,types,cardinality='ONE',required=true)=>({id:portId,direction,acceptedTypes:types,cardinality,required});
const input=port('value','input',['PhonologicalForm']),out=port('value','output',['PhonologicalForm']);
const state=createRuntimeState({roots:[],objects:{}});
const phon=(symbols,opts={})=>({id:'p',valueType:'PhonologicalForm',tokens:symbols.map(t=>typeof t==='string'?{kind:'Phoneme',symbol:t,sourceMorphId:'m'}:t),zeroMorphIds:[],...opts});
const env={};
const run=(type,value,params={},resources={tables:{}})=>{
 const r=new NodeRegistry();registerCorePrimitives(r);
 const g={id:'g',nodes:[{id:'n',typeId:type,params}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}]};
 return executeGraph(g,r,{state,resources:g?resources:{}},{value:[value]});
};
const symbols=value=>value.tokens.filter(x=>x.kind==='Phoneme').map(x=>x.symbol).join('');
const boundary=(kind)=>({kind:'Boundary',boundary:kind,sourceMorphId:'m'});

test('environment matcher blocks across morpheme, syllable and word boundaries without permission',()=>{
 for(const kind of ['Morpheme','Syllable','Word']){
  const value=phon(['n',boundary(kind),'p']);
  const param={target:'n',right:'p'};
  const blocked=run('phon.environment-match',value,param);
  assert.deepEqual(blocked.diagnostics,[]);
  assert.equal(blocked.outputs.value?.length??0,0,kind);
  const flag={Morpheme:'crossMorpheme',Syllable:'crossSyllable',Word:'crossWord'}[kind];
  const allowed=run('phon.environment-match',value,{...param,[flag]:true});
  assert.equal(allowed.outputs.value.length,1,kind);
 }
});
test('replace / delete / insert / metathesize are immutable and retain provenance',()=>{
 const value=phon(['n','p','a']);
 assert.equal(symbols(run('phon.replace',value,{target:'n',replaceWith:'m',right:'p'}).outputs.value[0]),'mpa');
 assert.equal(symbols(run('phon.delete',value,{target:'n',right:'p'}).outputs.value[0]),'pa');
 assert.equal(symbols(run('phon.insert',value,{target:'p',insert:'ə',position:'after'}).outputs.value[0]),'npəa');
 assert.equal(symbols(run('phon.metathesize',value,{left:'n',right:'p'}).outputs.value[0]),'pna');
 assert.equal(value.tokens[0].symbol,'n');
 assert.equal(run('phon.replace',value,{target:'n',replaceWith:'m',right:'p'}).outputs.value[0].tokens[0].sourceMorphId,'m');
});
test('assimilation, harmony, lenition and fortition derive from authored mapping data',()=>{
 const value=phon(['n','p','a']);
 assert.equal(symbols(run('phon.assimilate',value,{target:'n',right:'p',mapping:{'n:p':'m'}}).outputs.value[0]),'mpa');
 assert.equal(symbols(run('phon.harmony',phon(['a','b','i']),{trigger:'a',mapping:{i:'e'}}).outputs.value[0]),'abe');
 assert.equal(symbols(run('phon.lenition',value,{mapping:{p:'b'}}).outputs.value[0]),'nba');
 assert.equal(symbols(run('phon.fortition',phon(['b','a']),{mapping:{b:'p'}}).outputs.value[0]),'pa');
});
test('stress and syllabification produce explicit structural tokens instead of punctuation',()=>{
 const p=phon(['k','a','t','a']);
 const stressed=run('phon.stress',p,{target:'a',level:'Primary'}).outputs.value[0];
 assert.equal(stressed.tokens.filter(t=>t.kind==='Stress').length,1);
 const syllabified=run('phon.syllabify',p,{beforeSymbols:['t']}).outputs.value[0];
 assert.equal(syllabified.tokens.filter(t=>t.kind==='Boundary'&&t.boundary==='Syllable').length,1);
 assert.equal(symbols(syllabified),'kata');
});
test('replacement respects phonological environment and retains boundaries after rewrite',()=>{
 const p=phon(['n',boundary('Morpheme'),'p']);
 assert.equal(symbols(run('phon.replace',p,{target:'n',right:'p',replaceWith:'m'}).outputs.value[0]),'np');
 assert.equal(symbols(run('phon.replace',p,{target:'n',right:'p',replaceWith:'m',crossMorpheme:true}).outputs.value[0]),'mp');
 assert.equal(run('phon.replace',p,{target:'n',right:'p',replaceWith:'m',crossMorpheme:true}).outputs.value[0].tokens.filter(t=>t.kind==='Boundary').length,1);
});
test('replacement, insertion and deletion refuse absent targets rather than rewriting every phoneme',()=>{
 const value=phon(['a','b']);
 assert.equal(run('phon.replace',value,{replaceWith:'x'}).diagnostics[0].code,'INVALID_PHONOLOGY_PARAMETER');
 assert.equal(run('phon.insert',value,{insert:'ə'}).diagnostics[0].code,'INVALID_PHONOLOGY_PARAMETER');
 assert.equal(run('phon.delete',value,{}).diagnostics[0].code,'INVALID_PHONOLOGY_PARAMETER');
});
