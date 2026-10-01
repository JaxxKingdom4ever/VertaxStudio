import test from 'node:test';import assert from 'node:assert/strict';
import {NodeRegistry,executeGraph,createRuntimeState} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
const r=new NodeRegistry();registerCorePrimitives(r);
const state=createRuntimeState({roots:[],objects:{}});
const run=(type,value,params={},resources={tables:{}})=>executeGraph({id:'graph:writer',nodes:[{id:'node:writer',typeId:type,params}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'node:writer',nodePortId:type==='surface.space'?'values':'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'node:writer',nodePortId:'value'}]},r,{state,resources},{value:[value]});
const p={id:'phon:p',valueType:'PhonologicalForm',zeroMorphIds:['zero:present'],tokens:[
 {kind:'Phoneme',symbol:'k',sourceMorphId:'root:1',sourceObjectId:'e'},
 {kind:'Phoneme',symbol:'a',sourceMorphId:'root:1',sourceObjectId:'e'},
 {kind:'Boundary',boundary:'Morpheme',sourceMorphId:'suffix:1'},
 {kind:'Phoneme',symbol:'t',sourceMorphId:'suffix:1',sourceObjectId:'e'},
 {kind:'Phoneme',symbol:'a',sourceMorphId:'suffix:1',sourceObjectId:'e'}]};
const table={id:'spell',label:'Spelling',columns:['phoneme','grapheme'],rows:[{phoneme:'k',grapheme:'c'},{phoneme:'a',grapheme:'a'},{phoneme:'t',grapheme:'t'}],metadata:{}};
const mapped=form=>Object.entries(form.sourceMap??{}).map(([span,ids])=>({span,ids}));
const valid=(form)=>Object.keys(form.sourceMap??{}).every(offset=>{const m=/^(\d+):(\d+)$/.exec(offset);return m && +m[1]>=0 && +m[2]<=form.text.length && +m[1]<+m[2]});

test('node runtime context exposes authoring node identity',()=>{
 const probe=new NodeRegistry();probe.register({typeId:'probe',inputs:[{id:'value',direction:'input',acceptedTypes:['Entity'],cardinality:'ONE',required:true}],outputs:[{id:'value',direction:'output',acceptedTypes:['Entity'],cardinality:'ONE',required:true}],evaluate:(ctx,i)=>({outputs:{value:i.value.map(v=>({...v,conceptId:ctx.nodeId+'@'+ctx.graphId}))},diagnostics:[]})});
 const event={id:'e',type:'Entity',roles:{},features:{values:{}}};
 const graph={id:'g',nodes:[{id:'n',typeId:'probe',params:{}}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'n',nodePortId:'value'}]};
 assert.equal(executeGraph(graph,probe,{state},{value:[event]}).outputs.value[0].conceptId,'n@g');
});
test('spelling tables realize boundary symbols and preserve each phoneme origin',()=>{
 const result=run('surface.spell',p,{tableId:'spell',boundaries:{Morpheme:"'"}},{tables:{spell:table}});
 assert.deepEqual(result.diagnostics,[]);
 const form=result.outputs.value[0];
 assert.equal(form.text,"ca'ta");
 assert.equal(form.segments.map(x=>x.text).join(''),form.text);
 assert.equal(form.segments[0].nodeIds[0],'node:writer');
 assert.ok(mapped(form).some(x=>x.ids.includes('root:1')));
 assert.ok(mapped(form).some(x=>x.ids.includes('suffix:1')));
 assert.ok(!JSON.stringify(form).includes('zero:present'));
 assert.ok(valid(form));
});
test('orthographic capitalization, punctuation, and variable-length rewrites rebuild source map offsets',()=>{
 const raw=run('surface.spell',p,{tableId:'spell',boundaries:{Morpheme:"'"}},{tables:{spell:table}}).outputs.value[0];
 const upper=run('surface.capitalize',raw,{style:'sentence'}).outputs.value[0];
 assert.equal(upper.text,"Ca'ta");
 const punct=run('surface.punctuate',upper,{suffix:'!'}).outputs.value[0];
 assert.equal(punct.text,"Ca'ta!");
 const rewrite=run('surface.rewrite',punct,{from:'Ca',to:'Cha'}).outputs.value[0];
 assert.equal(rewrite.text,"Cha'ta!");
 assert.ok(valid(rewrite));
 assert.equal(rewrite.segments.map(x=>x.text).join(''),rewrite.text);
 assert.ok(rewrite.segments.some(x=>x.nodeIds.includes('node:writer')));
 assert.ok(mapped(rewrite).some(x=>x.ids.includes('root:1')));
});
test('word/morpheme/syllable boundaries are authored separately, and zero morphs never spell',()=>{
 const value={...p,tokens:[p.tokens[0],{kind:'Boundary',boundary:'Syllable'},p.tokens[1],{kind:'Boundary',boundary:'Word'},p.tokens[3]]};
 const out=run('surface.spell',value,{boundaries:{Syllable:'.',Word:' ',Morpheme:"'"}}).outputs.value[0];
 assert.equal(out.text,'k.a t');
 assert.ok(valid(out));
});
test('unknown table row or missing spelling table gives an explicit diagnostic',()=>{
 const result=run('surface.spell',p,{tableId:'missing'});
 assert.equal(result.diagnostics[0].code,'MISSING_SPELLING_TABLE');
});
test('rewrite keeps valid UTF-16 offsets when replacing non-BMP symbols with different lengths',()=>{
 const initial={id:'unicode',text:'😀x',segments:[{kind:'Grapheme',text:'😀',sourceIds:['source:emoji'],nodeIds:['node:emoji']},{kind:'Grapheme',text:'x',sourceIds:['source:x'],nodeIds:['node:x']}]};
 const rewritten=run('surface.rewrite',initial,{from:'😀',to:'s'}).outputs.value[0];
 assert.equal(rewritten.text,'sx');
 assert.ok(valid(rewritten));
 assert.deepEqual(rewritten.segments.map(s=>s.text).join(''),'sx');
 assert.equal(rewritten.segments[0].sourceIds[0],'source:emoji');
 assert.equal(rewritten.segments.at(-1).sourceIds[0],'source:x');
});
