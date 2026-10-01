import test from "node:test";
import assert from "node:assert/strict";
import { NodeRegistry } from "../../../dist/packages/runtime/src/index.js";
import { compileMeaningGraph } from "../../../dist/packages/compiler/src/index.js";

const port=(id,direction,types)=>({id,direction,acceptedTypes:types,cardinality:"ONE",required:true});
function setup(){
 const r=new NodeRegistry();
 r.register({typeId:"test.to-grammar",inputs:[port("value","input",["Entity"])],outputs:[port("value","output",["MorphCandidate"])],evaluate:(_c,i)=>({outputs:{value:[{id:"g:"+i.value[0].id,kind:"MorphCandidate",children:[],features:{values:{grammarDone:true}},data:{form:"hello"}}]},diagnostics:[]})});
 r.register({typeId:"test.to-morph",inputs:[port("value","input",["MorphCandidate"])],outputs:[port("value","output",["MorphSequence"])],evaluate:(_c,i)=>({outputs:{value:[{id:"m:"+i.value[0].id,morphs:[{id:"root:hello",kind:"Root",form:"hello",features:{values:{}}}]}]},diagnostics:[]})});
 r.register({typeId:"test.to-surface",inputs:[port("value","input",["MorphSequence"])],outputs:[port("value","output",["SurfaceForm"])],evaluate:(_c,i)=>({outputs:{value:[{id:"s:"+i.value[0].id,text:"hello"}]},diagnostics:[]})});
 return r;
}
const graph=(id,typeId)=>({id,nodes:[{id:"n",typeId,params:{}}],edges:[],exposedInputs:[{graphPortId:"value",nodeId:"n",nodePortId:"value"}],exposedOutputs:[{graphPortId:"value",nodeId:"n",nodePortId:"value"}]});
const project={resources:{lexemes:{},conceptToLexemeIds:{},tables:{}},grammar:{stage:"Grammar",graphs:{gg:graph("gg","test.to-grammar")},rules:[{id:"rg",stage:"Grammar",matcher:{kind:"type",type:"Entity"},graphId:"gg",priority:0,fallback:false}]},morphology:{stage:"Morphology",graphs:{gm:graph("gm","test.to-morph")},rules:[{id:"rm",stage:"Morphology",matcher:{kind:"type",type:"MorphCandidate"},graphId:"gm",priority:0,fallback:false}]},surface:{stage:"Surface",graphs:{gs:graph("gs","test.to-surface")},rules:[{id:"rs",stage:"Surface",matcher:{kind:"type",type:"MorphSequence"},graphId:"gs",priority:0,fallback:false}]}};
const meaning={roots:["e"],objects:{e:{id:"e",type:"Entity",conceptId:"HELLO",roles:{},features:{values:{}}}}};

test("pipeline compiles MeaningGraph through grammar morphology and surface with trace",()=>{
 const result=compileMeaningGraph(project,setup(),meaning,{mode:"trace",maxStepsPerStage:10});
 assert.equal(result.success,true); assert.equal(result.surface,"hello"); assert.ok(result.trace.length>=3);
 assert.equal(result.trace[0].stage,"Grammar"); assert.equal(typeof result.trace[0].beforeFingerprint,"string"); assert.equal(typeof result.trace[0].afterFingerprint,"string");
});

test("fast mode may omit detailed trace but preserves successful output",()=>{
 const result=compileMeaningGraph(project,setup(),meaning,{mode:"fast",maxStepsPerStage:10});
 assert.equal(result.surface,"hello"); assert.deepEqual(result.trace,[]); assert.deepEqual(result.diagnostics,[]);
});
