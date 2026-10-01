import test from "node:test";
import assert from "node:assert/strict";
import { NodeRegistry, createRuntimeState, executeGraph } from "../../../dist/packages/runtime/src/index.js";

const entity = { id: "e1", type: "Entity", conceptId: "PERSON", roles: {}, features: { values: {} } };
const graphState = createRuntimeState({ roots: ["e1"], objects: { e1: entity } });
const port = (id, direction, acceptedTypes=["Entity"], required=true) => ({ id, direction, acceptedTypes, cardinality: "ONE", required });

function registry() {
  const r = new NodeRegistry();
  r.register({
    typeId: "test.identity",
    inputs: [port("in", "input")], outputs: [port("out", "output")],
    evaluate: (_ctx, inputs) => ({ outputs: { out: inputs.in }, diagnostics: [] })
  });
  r.register({
    typeId: "test.set-feature",
    inputs: [port("in", "input")], outputs: [port("out", "output")],
    evaluate: (_ctx, inputs, params) => {
      const value = inputs.in[0];
      return { outputs: { out: [{ ...value, features: { values: { ...value.features.values, [params.featureId]: params.value } } }] }, diagnostics: [] };
    }
  });
  return r;
}

test("graph executes by data dependency and produces exposed output", () => {
  const graph = {
    id: "g1",
    nodes: [
      { id: "b", typeId: "test.set-feature", params: { featureId: "tense", value: "past" } },
      { id: "a", typeId: "test.identity", params: {} }
    ],
    edges: [{ sourceNodeId: "a", sourcePortId: "out", targetNodeId: "b", targetPortId: "in" }],
    exposedInputs: [{ graphPortId: "input", nodeId: "a", nodePortId: "in" }],
    exposedOutputs: [{ graphPortId: "output", nodeId: "b", nodePortId: "out" }]
  };
  const result = executeGraph(graph, registry(), { state: graphState }, { input: [entity] });
  assert.deepEqual(result.outputs.output[0].features.values, { tense: "past" });
  assert.deepEqual(result.diagnostics, []);
});

test("runtime port type mismatch is diagnosed", () => {
  const morph = { id: "m1", morphs: [] };
  const graph = {
    id: "g2", nodes: [{ id: "a", typeId: "test.identity", params: {} }], edges: [],
    exposedInputs: [{ graphPortId: "input", nodeId: "a", nodePortId: "in" }],
    exposedOutputs: [{ graphPortId: "output", nodeId: "a", nodePortId: "out" }]
  };
  const result = executeGraph(graph, registry(), { state: graphState }, { input: [morph] });
  assert.equal(result.diagnostics[0]?.code, "PORT_TYPE_MISMATCH");
});

test("MANY ports accumulate values from multiple incoming edges", () => {
  const r=registry();
  r.register({
    typeId:"test.collect",
    inputs:[{id:"values",direction:"input",acceptedTypes:["Entity"],cardinality:"MANY",required:true}],
    outputs:[{id:"out",direction:"output",acceptedTypes:["SemanticList"],cardinality:"ONE",required:true}],
    evaluate:(_c,inputs)=>({outputs:{out:[{id:"list",type:"SemanticList",conceptId:"LIST",roles:{members:inputs.values.map(v=>v.id)},features:{values:{count:inputs.values.length}}}]},diagnostics:[]})
  });
  const graph={id:"many",nodes:[{id:"a",typeId:"test.identity",params:{}},{id:"b",typeId:"test.identity",params:{}},{id:"c",typeId:"test.collect",params:{}}],edges:[
    {sourceNodeId:"a",sourcePortId:"out",targetNodeId:"c",targetPortId:"values"},
    {sourceNodeId:"b",sourcePortId:"out",targetNodeId:"c",targetPortId:"values"}
  ],exposedInputs:[{graphPortId:"a",nodeId:"a",nodePortId:"in"},{graphPortId:"b",nodeId:"b",nodePortId:"in"}],exposedOutputs:[{graphPortId:"output",nodeId:"c",nodePortId:"out"}]};
  const e2={...entity,id:"e2"};
  const result=executeGraph(graph,r,{state:graphState},{a:[entity],b:[e2]});
  assert.equal(result.outputs.output[0].features.values.count,2);
});

test("ONE port rejects multiple values", () => {
  const graph={id:"one",nodes:[{id:"a",typeId:"test.identity",params:{}}],edges:[],exposedInputs:[{graphPortId:"input",nodeId:"a",nodePortId:"in"}],exposedOutputs:[{graphPortId:"output",nodeId:"a",nodePortId:"out"}]};
  const result=executeGraph(graph,registry(),{state:graphState},{input:[entity,{...entity,id:"e2"}]});
  assert.equal(result.diagnostics[0]?.code,"PORT_CARDINALITY_MISMATCH");
});

test("node output must satisfy its declared output type", () => {
  const r=new NodeRegistry();
  r.register({
    typeId:"test.bad-output",
    inputs:[port("in","input")], outputs:[port("out","output")],
    evaluate:()=>({outputs:{out:[{id:"m",morphs:[]}]},diagnostics:[]})
  });
  const graph={id:"bad",nodes:[{id:"a",typeId:"test.bad-output",params:{}}],edges:[],exposedInputs:[{graphPortId:"input",nodeId:"a",nodePortId:"in"}],exposedOutputs:[{graphPortId:"output",nodeId:"a",nodePortId:"out"}]};
  const result=executeGraph(graph,r,{state:graphState},{input:[entity]});
  assert.equal(result.diagnostics[0]?.code,"NODE_OUTPUT_TYPE_MISMATCH");
});

test('registry exposes a copy of definitions in registration order',()=>{
  const r=registry();
  const listed=r.listDefinitions();
  assert.deepEqual(listed.map(def=>def.typeId),['test.identity','test.set-feature']);
  assert.notEqual(listed,r.listDefinitions());
});
