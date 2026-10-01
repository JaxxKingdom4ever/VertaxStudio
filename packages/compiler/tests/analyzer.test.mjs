import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSurface } from '../../../dist/packages/compiler/src/index.js';
import { NodeRegistry } from '../../../dist/packages/runtime/src/index.js';

const pass=(kind,output)=>({
  typeId:`test.${kind}`,inputs:[{id:'value',direction:'input',acceptedTypes:[kind],required:true,cardinality:'ONE'}],
  outputs:[{id:'value',direction:'output',acceptedTypes:[output],required:true,cardinality:'MANY'}],
  evaluate(_ctx,inputs){const values=inputs.value;
    if(output==='SemanticGraphValue')return {outputs:{value:[0,1].map(i=>({valueType:'SemanticGraphValue',id:`meaning:${i}`,graph:{roots:['e'],objects:{e:{id:'e',type:'Event',conceptId:'sem:see',roles:{instrument:i?['t']:[]},features:{values:{}},},t:{id:'t',type:'Entity',conceptId:'sem:telescope',roles:{},features:{values:{}}}}}}))},diagnostics:[]};
    return {outputs:{value:values.map(v=>({id:v.id,valueType:output, ...(output==='OrthographicTokenSequence'?{tokens:[]} : output==='MorphAnalysis'?{tokens:[],features:{values:{}}}:{rootId:'n',nodes:{n:{}}})}))},diagnostics:[]};
  }
});
function stage(stage,inType,outType){const node={id:'one',typeId:`test.${inType}`,params:{}};const graph={id:`g:${stage}`,nodes:[node],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'one',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'one',nodePortId:'value'}]};return {stage,graphs:{[graph.id]:graph},rules:[{id:`r:${stage}`,stage,matcher:{kind:'type',type:inType},graphId:graph.id,priority:0,fallback:false}]}}
const project={orthography:stage('OrthographyAnalysis','SourceText','OrthographicTokenSequence'),morphology:stage('MorphologyAnalysis','OrthographicTokenSequence','MorphAnalysis'),grammar:stage('GrammarAnalysis','MorphAnalysis','SyntacticAnalysis'),meaning:stage('MeaningAnalysis','SyntacticAnalysis','SemanticGraphValue'),resources:{concepts:{},featureDefinitions:{},lexemes:{},tables:{},conceptToLexemeIds:{}}};
const registry=new NodeRegistry();registry.register(pass('SourceText','OrthographicTokenSequence'));registry.register(pass('OrthographicTokenSequence','MorphAnalysis'));registry.register(pass('MorphAnalysis','SyntacticAnalysis'));registry.register(pass('SyntacticAnalysis','SemanticGraphValue'));
test('reverse pipeline keeps two structurally different meanings instead of choosing one',()=>{
 const r=analyzeSurface(project,registry,'I saw the man with the telescope.',{mode:'trace',maxStepsPerStage:50});
 assert.equal(r.success,true);
 assert.equal(r.candidates.length,2);
 assert.notEqual(r.candidates[0].id,r.candidates[1].id);
 assert.equal(r.trace.length,4);
 assert.equal(r.debugFrames.length,4);
});
test('candidate IDs, ordering and semantics are deterministic across executions',()=>{
 const opts={mode:'fast',maxStepsPerStage:20}; const a=analyzeSurface(project,registry,'Test.',opts),b=analyzeSurface(project,registry,'Test.',opts);
 assert.deepEqual(a.candidates,b.candidates);
 assert.deepEqual(a.trace,[]);
 assert.equal(a.candidates.length,2);
});
