import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeRegistry, executeGraph, createRuntimeState } from '../../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../dist/packages/primitives/src/index.js';

const value={id:'v',type:'Entity',roles:{},features:{values:{}},conceptId:'sem:entity.person'};
const state=()=>createRuntimeState({roots:['v'],objects:{v:value}});
const i=(id,cardinality='ONE',required=true)=>({id,direction:'input',acceptedTypes:['Entity'],cardinality,required});
const o=(id='value',required=true)=>({id,direction:'output',acceptedTypes:['Entity'],cardinality:'MANY',required});
const reg=()=>{const r=new NodeRegistry();registerCorePrimitives(r);return r};

test('unselected branches resolve as skipped without false dependency cycles',()=>{
 const r=reg();r.register({typeId:'test.filter',inputs:[i('value')],outputs:[o('value',false)],evaluate:()=>({outputs:{value:[]},diagnostics:[]})});
 r.register({typeId:'test.pass',inputs:[i('value')],outputs:[o()],evaluate:(_c,ins)=>({outputs:{value:ins.value},diagnostics:[]})});
 const graph={id:'false',nodes:[{id:'filter',typeId:'test.filter',params:{}},{id:'downstream',typeId:'test.pass',params:{}}],edges:[{sourceNodeId:'filter',sourcePortId:'value',targetNodeId:'downstream',targetPortId:'value'}],exposedInputs:[{graphPortId:'value',nodeId:'filter',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'downstream',nodePortId:'value'}]};
 const result=executeGraph(graph,r,{state:state()},{value:[value]});
 assert.deepEqual(result.diagnostics,[]);
 assert.deepEqual(result.outputs.value,[]);
 assert.deepEqual(result.nodeIds,['filter']);
});

test('genuine unresolved dependency cycle still returns CYCLIC_GRAPH_EDGE',()=>{
 const r=reg();r.register({typeId:'test.pass',inputs:[i('value')],outputs:[o()],evaluate:(_c,ins)=>({outputs:{value:ins.value},diagnostics:[]})});
 const graph={id:'cycle',nodes:[{id:'a',typeId:'test.pass',params:{}},{id:'b',typeId:'test.pass',params:{}}],edges:[{sourceNodeId:'a',sourcePortId:'value',targetNodeId:'b',targetPortId:'value'},{sourceNodeId:'b',sourcePortId:'value',targetNodeId:'a',targetPortId:'value'}],exposedInputs:[],exposedOutputs:[]};
 const result=executeGraph(graph,r,{state:state()},{});
 assert.ok(result.diagnostics.some(d=>d.code==='CYCLIC_GRAPH_EDGE'));
});

test('missing required graph input is a validation error, not a silently skipped node',()=>{
 const r=reg();r.register({typeId:'test.pass',inputs:[i('value')],outputs:[o()],evaluate:(_c,ins)=>({outputs:{value:ins.value},diagnostics:[]})});
 const graph={id:'missing',nodes:[{id:'a',typeId:'test.pass',params:{}}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'a',nodePortId:'value'}],exposedOutputs:[]};
 const result=executeGraph(graph,r,{state:state()},{});
 assert.ok(result.diagnostics.some(d=>d.code==='MISSING_REQUIRED_GRAPH_INPUT'));
});

test('collector waits for all incoming producers before running (regardless of node ID)',()=>{
 const r=reg();r.register({typeId:'test.emit',inputs:[],outputs:[o()],evaluate:(_c,_i,p)=>({outputs:{value:[{...value,id:String(p.id)}]},diagnostics:[]})});
 r.register({typeId:'test.pass',inputs:[i('value')],outputs:[o()],evaluate:(_c,ins)=>({outputs:{value:ins.value},diagnostics:[]})});
 r.register({typeId:'test.join',inputs:[i('items','MANY')],outputs:[o()],evaluate:(_c,ins)=>({outputs:{value:ins.items},diagnostics:[]})});
 const graph={id:'collect',nodes:[{id:'a-collector',typeId:'test.join',params:{}},{id:'b-early',typeId:'test.emit',params:{id:'early'}},{id:'c-delayed',typeId:'test.pass',params:{}},{id:'d-late',typeId:'test.emit',params:{id:'late'}}],edges:[{sourceNodeId:'b-early',sourcePortId:'value',targetNodeId:'a-collector',targetPortId:'items'},{sourceNodeId:'d-late',sourcePortId:'value',targetNodeId:'c-delayed',targetPortId:'value'},{sourceNodeId:'c-delayed',sourcePortId:'value',targetNodeId:'a-collector',targetPortId:'items'}],exposedInputs:[],exposedOutputs:[{graphPortId:'value',nodeId:'a-collector',nodePortId:'value'}]};
 const result=executeGraph(graph,r,{state:state()},{});
 assert.deepEqual(result.diagnostics,[]);
 assert.deepEqual(result.outputs.value.map(x=>x.id),['early','late']);
 assert.equal(result.nodeIds.at(-1),'a-collector');
});
