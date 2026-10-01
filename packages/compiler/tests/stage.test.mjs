import test from "node:test";
import assert from "node:assert/strict";
import { NodeRegistry, createRuntimeState, openRequirement } from "../../../dist/packages/runtime/src/index.js";
import { compileStage } from "../../../dist/packages/compiler/src/index.js";

const entity = (id, features={}) => ({ id, type:"Entity", conceptId:"PERSON", roles:{}, features:{values:features} });
const port = (id, direction) => ({ id, direction, acceptedTypes:["Entity"], cardinality:"ONE", required:true });
function registry(change=true) {
  const r = new NodeRegistry();
  r.register({ typeId:"test.mark", inputs:[port("value","input")], outputs:[port("value","output")], evaluate:(_c,i)=>({outputs:{value:[change?{...i.value[0],features:{values:{...i.value[0].features.values,done:true}}}:i.value[0]]},diagnostics:[]}) });
  return r;
}
const graph = { id:"g", nodes:[{id:"n",typeId:"test.mark",params:{}}], edges:[], exposedInputs:[{graphPortId:"value",nodeId:"n",nodePortId:"value"}], exposedOutputs:[{graphPortId:"value",nodeId:"n",nodePortId:"value"}] };

test("stage applies matching rule until fixed point", () => {
  const project={stage:"Grammar",graphs:{g:graph},rules:[{id:"r",stage:"Grammar",matcher:{kind:"all",matchers:[{kind:"type",type:"Entity"},{kind:"featureEquals",featureId:"done",value:undefined}]},graphId:"g",priority:0,fallback:false}]};
  const state=createRuntimeState({roots:[],objects:{}});
  const result=compileStage(project,registry(true),state,[entity("a")],{maxSteps:10,trace:true});
  assert.equal(result.success,true);
  assert.equal(result.values[0].features.values.done,true);
  assert.equal(result.trace.length,1);
});

test("no-progress recursive rule halts safely", () => {
  const project={stage:"Grammar",graphs:{g:graph},rules:[{id:"r",stage:"Grammar",matcher:{kind:"type",type:"Entity"},graphId:"g",priority:0,fallback:false}]};
  const result=compileStage(project,registry(false),createRuntimeState({roots:[],objects:{}}),[entity("a")],{maxSteps:10,trace:true});
  assert.equal(result.success,false);
  assert.equal(result.diagnostics[0]?.code,"NO_PROGRESS_RECURSION");
});

test("max stage steps terminates changing recursion", () => {
  const r=new NodeRegistry();
  r.register({ typeId:"test.bump", inputs:[port("value","input")], outputs:[port("value","output")], evaluate:(_c,i)=>({outputs:{value:[{...i.value[0],features:{values:{...i.value[0].features.values,n:(i.value[0].features.values.n??0)+1}}}]},diagnostics:[]}) });
  const bumpGraph={...graph,nodes:[{id:"n",typeId:"test.bump",params:{}}]};
  const project={stage:"Grammar",graphs:{g:bumpGraph},rules:[{id:"r",stage:"Grammar",matcher:{kind:"type",type:"Entity"},graphId:"g",priority:0,fallback:false}]};
  const result=compileStage(project,r,createRuntimeState({roots:[],objects:{}}),[entity("a")],{maxSteps:2,trace:true});
  assert.equal(result.diagnostics.at(-1)?.code,"MAX_STAGE_STEPS_EXCEEDED");
});

test("open requirements fail stage completion", () => {
  let state=createRuntimeState({roots:[],objects:{}});
  state=openRequirement(state,{id:"req",creatorId:"PLACE",acceptedTypes:["Relation"]});
  const result=compileStage({stage:"Grammar",graphs:{},rules:[]},new NodeRegistry(),state,[],{maxSteps:10,trace:true});
  assert.equal(result.success,false);
  assert.equal(result.diagnostics[0]?.code,"UNRESOLVED_REQUIREMENT");
});
