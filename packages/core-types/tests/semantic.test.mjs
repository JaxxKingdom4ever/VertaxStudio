import test from "node:test";
import assert from "node:assert/strict";
import { validateSemanticGraph } from "../../../dist/packages/core-types/src/index.js";

const graph = {
  roots: ["see-1"],
  objects: {
    "hunter-1": { id: "hunter-1", type: "Entity", conceptId: "HUNTER", roles: {}, features: { values: {} } },
    "see-1": {
      id: "see-1",
      type: "Event",
      conceptId: "SEE",
      roles: { agent: ["hunter-1"], patient: ["hunter-1"] },
      features: { values: {} }
    }
  }
};

test("valid semantic graph has no diagnostics and preserves stable identity", () => {
  assert.deepEqual(validateSemanticGraph(graph), []);
  const agentId = graph.objects["see-1"].roles.agent[0];
  const patientId = graph.objects["see-1"].roles.patient[0];
  assert.equal(agentId, "hunter-1");
  assert.strictEqual(graph.objects[agentId], graph.objects[patientId]);
});

test("missing semantic role target is diagnosed", () => {
  const invalid = {
    roots: ["see-1"],
    objects: {
      "see-1": { id: "see-1", type: "Event", conceptId: "SEE", roles: { agent: ["missing"] }, features: { values: {} } }
    }
  };
  assert.equal(validateSemanticGraph(invalid)[0]?.code, "MISSING_SEMANTIC_REFERENCE");
});
