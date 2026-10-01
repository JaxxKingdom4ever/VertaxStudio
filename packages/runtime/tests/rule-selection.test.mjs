import test from "node:test";
import assert from "node:assert/strict";
import { matchObject, selectRule } from "../../../dist/packages/runtime/src/index.js";

const pastEvent = { id: "e1", type: "Event", conceptId: "SEE", roles: {}, features: { values: { tense: "past" } } };

test("matcher reports specificity from atomic predicates", () => {
  const matcher = { kind: "all", matchers: [
    { kind: "type", type: "Event" },
    { kind: "featureEquals", featureId: "tense", value: "past" }
  ] };
  assert.deepEqual(matchObject(matcher, pastEvent), { matched: true, specificity: 2 });
});

test("more specific rule beats general rule", () => {
  const general = { id: "general", stage: "Grammar", matcher: { kind: "type", type: "Event" }, graphId: "g1", priority: 0, fallback: false };
  const specific = { id: "specific", stage: "Grammar", matcher: { kind: "all", matchers: [
    { kind: "type", type: "Event" }, { kind: "featureEquals", featureId: "tense", value: "past" }
  ] }, graphId: "g2", priority: 0, fallback: false };
  assert.equal(selectRule([general, specific], pastEvent).rule?.id, "specific");
});

test("equal rules report ambiguity instead of using array order", () => {
  const matcher = { kind: "type", type: "Event" };
  const a = { id: "a", stage: "Grammar", matcher, graphId: "g1", priority: 5, fallback: false };
  const b = { id: "b", stage: "Grammar", matcher, graphId: "g2", priority: 5, fallback: false };
  const result = selectRule([b, a], pastEvent);
  assert.equal(result.rule, undefined);
  assert.equal(result.diagnostics[0]?.code, "AMBIGUOUS_RULE");
});
