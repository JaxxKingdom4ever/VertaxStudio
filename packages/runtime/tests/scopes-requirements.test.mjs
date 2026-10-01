import test from "node:test";
import assert from "node:assert/strict";
import {
  createRuntimeState, openScope, closeScope, openRequirement, resolveRequirement
} from "../../../dist/packages/runtime/src/index.js";

const graph = { roots: [], objects: {} };

test("scopes preserve parentage immutably", () => {
  const initial = createRuntimeState(graph);
  const next = openScope(initial, { id: "child", type: "Complement" });
  assert.notStrictEqual(next, initial);
  assert.equal(initial.scopes["child"], undefined);
  assert.equal(next.scopes.child.parentId, initial.currentScopeId);
  assert.ok(next.scopes[next.currentScopeId]);
  const closed = closeScope(next, "child");
  assert.equal(closed.currentScopeId, initial.currentScopeId);
  assert.equal(closed.scopes.child.status, "RESOLVED");
});

test("requirements attach to current scope and resolve compatible values", () => {
  const initial = createRuntimeState(graph);
  const child = openScope(initial, { id: "child", type: "Complement" });
  const withReq = openRequirement(child, {
    id: "req-1", creatorId: "PLACE", acceptedTypes: ["Relation"]
  });
  assert.ok(withReq.scopes.child.requirementIds.includes("req-1"));
  const relation = { id: "on-1", type: "Relation", conceptId: "ON", roles: {}, features: { values: {} } };
  const resolved = resolveRequirement(withReq, "req-1", relation);
  assert.equal(resolved.state.requirements["req-1"].status, "RESOLVED");
  assert.equal(resolved.state.requirements["req-1"].resolutionId, "on-1");
  assert.deepEqual(resolved.diagnostics, []);
});

test("incompatible requirement resolution is diagnosed without mutation", () => {
  const initial = openRequirement(createRuntimeState(graph), {
    id: "req-1", creatorId: "PLACE", acceptedTypes: ["Relation"]
  });
  const entity = { id: "book-1", type: "Entity", conceptId: "BOOK", roles: {}, features: { values: {} } };
  const result = resolveRequirement(initial, "req-1", entity);
  assert.equal(result.diagnostics[0]?.code, "REQUIREMENT_TYPE_MISMATCH");
  assert.strictEqual(result.state, initial);
  assert.equal(initial.requirements["req-1"].status, "OPEN");
});

test('closing a scope with an unresolved Requirement cannot mark that scope resolved',()=>{
 const initial=createRuntimeState(graph);
 const child=openScope(initial,{id:'complement',type:'Complement'});
 const pending=openRequirement(child,{id:'awaited-clause',creatorId:'call',acceptedTypes:['Event']});
 const closed=closeScope(pending,'complement');
 assert.equal(closed.currentScopeId,'scope:root');
 assert.equal(closed.scopes.complement.status,'FAILED');
 assert.equal(closed.requirements['awaited-clause'].status,'OPEN');
 assert.equal(pending.scopes.complement.status,'OPEN');
});
