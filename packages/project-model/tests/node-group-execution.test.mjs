import test from 'node:test';
import assert from 'node:assert/strict';
import {registerPersistedNodeGroups,nodeGroupTypeId} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry,executeGraph,createRuntimeState} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';

const input=(id,type)=>({id,direction:'input',acceptedTypes:[type],cardinality:'ONE',required:true});
const output=(id,type)=>({id,direction:'output',acceptedTypes:[type],cardinality:'ONE',required:true});
const morphCandidate={id:'example-word',kind:'MorphCandidate',children:[],features:{values:{}},data:{form:'example'}};
const state=()=>createRuntimeState({objects:{},roots:[]});
const graph=(typeId,params={})=>({id:'external',nodes:[{id:'call',typeId,params}],edges:[],exposedInputs:[{graphPortId:'value',nodeId:'call',nodePortId:'value'}],exposedOutputs:[{graphPortId:'value',nodeId:'call',nodePortId:'value'}]});
const group=(id,typeId,params,parameters=[])=>({schema_version:1,id,name:id,version:'1.0',inputs:[input('value','MorphCandidate')],outputs:[output('value','MorphSequence')],parameters,internal_graph:graph(typeId,params),test_ids:[]});

function registryWith(groups,options){const reg=new NodeRegistry();registerCorePrimitives(reg);registerPersistedNodeGroups(reg,groups,options);return reg;}

test('persisted Node Group exposes typed interface and resolves a defaulted parameter',()=>{
 const g=group('affix-maker','morph.root',{form:{$groupParam:'form'}},[{id:'form',label:'Form',valueType:'string',required:false,defaultValue:'hello'}]);
 const reg=registryWith({[g.id]:g});
 assert.equal(nodeGroupTypeId(g.id),'node-group:affix-maker');
 const result=executeGraph(graph(nodeGroupTypeId(g.id)),reg,{state:state()},{value:[morphCandidate]});
 assert.deepEqual(result.diagnostics,[]);
 assert.equal(result.outputs.value[0].morphs[0].form,'hello');
 const custom=executeGraph(graph(nodeGroupTypeId(g.id),{form:'world'}),reg,{state:state()},{value:[morphCandidate]});
 assert.equal(custom.outputs.value[0].morphs[0].form,'world');
});

test('persisted Node Groups call other groups and forward parameters',()=>{
 const leaf=group('leaf','morph.root',{form:{$groupParam:'form'}},[{id:'form',label:'Form',valueType:'string',required:true}]);
 const outer=group('outer','node-group:leaf',{form:{$groupParam:'outer-form'}},[{id:'outer-form',label:'Outer Form',valueType:'string',required:false,defaultValue:'nested'}]);
 const reg=registryWith({leaf,outer});
 const result=executeGraph(graph('node-group:outer'),reg,{state:state()},{value:[morphCandidate]});
 assert.deepEqual(result.diagnostics,[]);
 assert.equal(result.outputs.value[0].morphs[0].form,'nested');
});

test('recursive Node Groups fail with a structured recursion diagnostic',()=>{
 const recursion=group('recursive','node-group:recursive',{});
 const reg=registryWith({recursive:recursion},{maxDepth:5});
 const result=executeGraph(graph('node-group:recursive'),reg,{state:state()},{value:[morphCandidate]});
 assert.ok(result.diagnostics.some(d=>d.code==='NODE_GROUP_RECURSION_LIMIT'));
});

test('missing required group parameter is reported rather than replaced with undefined',()=>{
 const leaf=group('strict','morph.root',{form:{$groupParam:'form'}},[{id:'form',label:'Form',valueType:'string',required:true}]);
 const result=executeGraph(graph('node-group:strict'),registryWith({strict:leaf}),{state:state()},{value:[morphCandidate]});
 assert.ok(result.diagnostics.some(d=>d.code==='MISSING_NODE_GROUP_PARAMETER'));
});
