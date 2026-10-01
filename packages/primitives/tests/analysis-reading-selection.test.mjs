import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAnalysisPrimitives } from '../../../dist/packages/primitives/src/index.js';
import { createRuntimeState, NodeRegistry } from '../../../dist/packages/runtime/src/index.js';

const registry = new NodeRegistry();
registerAnalysisPrimitives(registry);
const context = {state:createRuntimeState({objects:{},roots:[]})};
const hypothesis = (words, options) => ({valueType:'MorphAnalysis',id:'source:lexical',features:{values:{}},tokens:words.map((text,i)=>({token:{id:`source:token:${i}`,text,normalized:text.toLowerCase(),start:i*5,end:i*5+text.length},options:options[i]}))});
const option = (lexemeId, conceptId, formKey, lexicalClass='Verb') => ({lexemeId,conceptId,formKey,lexicalClass});
const run = (morph,patterns,extra={}) => registry.get('analysis.match-pattern').evaluate(context,{value:[morph]},{patterns,...extra});
const meaning = hypothesis => registry.get('analysis.to-meaning').evaluate(context,{value:[hypothesis]},{formFeatureMap:{Verb:{past:{morphology:'past'},participle:{morphology:'participle'}}}}).outputs.value[0].graph;

test('a slot constraint chooses the agreeing inflection even when it is the second lexical option',()=>{
  const morph=hypothesis(['has','cooked'],[
    [option('have','sem:event.have','present3')],
    [option('cook','sem:event.cook','past'),option('cook','sem:event.cook','participle')]
  ]);
  const patterns=[{id:'perfect',slots:[{classes:['Verb'],formKeys:['present3']},{classes:['Verb'],formKeys:['past','participle']}],slotConstraints:[{leftSlot:0,rightSlot:1,allowedPairs:[['present3','participle']]}],meaning:{root:'event',objects:[{id:'event',type:'Event',slot:1}]}}];
  const parsed=run(morph,patterns);
  assert.deepEqual(parsed.diagnostics,[]);
  assert.equal(parsed.outputs.value.length,1);
  assert.equal(meaning(parsed.outputs.value[0]).objects.event.features.values.morphology,'participle');
});

test('homographs produce distinct meanings rather than whichever lexeme sorts first',()=>{
  const morph=hypothesis(['bank'],[[option('a-bank','sem:entity.riverbank','citation','Noun'),option('z-bank','sem:entity.financialbank','citation','Noun')]]);
  const patterns=[{id:'noun',slots:[{classes:['Noun']}],meaning:{root:'entity',objects:[{id:'entity',type:'Entity',slot:0}]}}];
  const result=run(morph,patterns);
  assert.deepEqual(result.diagnostics,[]);
  assert.equal(result.outputs.value.length,2);
  assert.equal(new Set(result.outputs.value.map(r=>r.id)).size,2,'each morphological reading has an independent trace identity');
  assert.deepEqual(result.outputs.value.map(r=>meaning(r).objects.entity.conceptId),['sem:entity.riverbank','sem:entity.financialbank']);
  assert.equal(result.outputs.value[0].nodes.entity.captures['0'].token.id,'source:token:0');
});

test('readings are deterministic across lexical-option ordering',()=>{
  const slots=[[option('z','sem:entity.riverbank','citation','Noun'),option('a','sem:entity.financialbank','citation','Noun')]];
  const pat=[{id:'noun',slots:[{classes:['Noun']}],meaning:{root:'e',objects:[{id:'e',type:'Entity',slot:0}]}}];
  const a=run(hypothesis(['bank'],slots),pat).outputs.value;
  const b=run(hypothesis(['bank'],[slots[0].toReversed()]),pat).outputs.value;
  assert.deepEqual(a,b);
});

test('analysis reports candidate explosion instead of silently truncating readings',()=>{
  const options=Array.from({length:4},(_,i)=>option(`noun-${i}`,`sem:entity.${i}`,'citation','Noun'));
  const morph=hypothesis(['a','b','c'],[options,options,options]);
  const patterns=[{id:'triple',slots:[{classes:['Noun']},{classes:['Noun']},{classes:['Noun']}],meaning:{root:'n',objects:[{id:'n',type:'Entity',slot:0}]}}];
  const result=run(morph,patterns,{maxHypotheses:16});
  assert.deepEqual(result.outputs.value,[]);
  assert.equal(result.diagnostics[0]?.code,'MAX_ANALYSIS_HYPOTHESES');
});

test('malformed slot constraints fail authoring validation instead of producing no analysis',()=>{
  const morph=hypothesis(['has'],[[option('have','sem:event.have','present3')]]);
  const invalid=[{id:'bad',slots:[{classes:['Verb']}],slotConstraints:[{leftSlot:0,rightSlot:2,allowedPairs:[['present3','past']]}],meaning:{root:'e',objects:[{id:'e',type:'Event',slot:0}]}}];
  const result=run(morph,invalid);
  assert.equal(result.diagnostics[0]?.code,'INVALID_ANALYSIS_PATTERNS');
});

test('bad lexical slot criteria return diagnostics, not a JavaScript exception',()=>{
  const morph=hypothesis(['cooked'],[[option('cook','sem:event.cook','past')]]);
  for(const slot of [{classes:'Verb'},{formKeys:4},{text:11},{lexemeIds:[null]}]){
    const result=run(morph,[{id:'invalid',slots:[slot],meaning:{root:'e',objects:[{id:'e',type:'Event',slot:0}]}}]);
    assert.equal(result.diagnostics[0]?.code,'INVALID_ANALYSIS_PATTERNS',JSON.stringify(slot));
  }
});
