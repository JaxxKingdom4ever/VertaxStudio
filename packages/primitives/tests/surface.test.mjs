import test from "node:test";
import assert from "node:assert/strict";
import { NodeRegistry, createRuntimeState, executeGraph } from "../../../dist/packages/runtime/src/index.js";
import { registerCorePrimitives } from "../../../dist/packages/primitives/src/index.js";

const state=createRuntimeState({roots:[],objects:{}});
const registry=new NodeRegistry(); registerCorePrimitives(registry);

test("surface join realizes apostrophe for a bound unit", () => {
  const bound={id:"b",kind:"BoundUnit",children:[],features:{values:{}},data:{parts:["person","vo"]}};
  const graph={id:"g",nodes:[{id:"j",typeId:"surface.join",params:{separator:"'"}}],edges:[],exposedInputs:[{graphPortId:"value",nodeId:"j",nodePortId:"value"}],exposedOutputs:[{graphPortId:"value",nodeId:"j",nodePortId:"value"}]};
  const result=executeGraph(graph,registry,{state},{value:[bound]});
  assert.equal(result.outputs.value[0].text,"person'vo");
});

test("surface space joins multiple surface forms into a clause", () => {
  const forms=["person'vo","duru","esi'cook","food"].map((text,i)=>({id:`s${i}`,text}));
  const graph={id:"g2",nodes:[{id:"s",typeId:"surface.space",params:{}}],edges:[],exposedInputs:[{graphPortId:"values",nodeId:"s",nodePortId:"values"}],exposedOutputs:[{graphPortId:"value",nodeId:"s",nodePortId:"value"}]};
  const result=executeGraph(graph,registry,{state},{values:forms});
  assert.equal(result.outputs.value[0].text,"person'vo duru esi'cook food");
});
