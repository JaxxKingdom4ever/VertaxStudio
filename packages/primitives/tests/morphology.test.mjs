import test from "node:test";
import assert from "node:assert/strict";
import { zeroMorph, prefixMorph, rootMorph, realizeMorphs } from "../../../dist/packages/primitives/src/index.js";

test("zero morph is valid but realizes no characters", () => {
  const zero = zeroMorph("present");
  assert.equal(zero.kind, "Zero");
  assert.equal(realizeMorphs([zero]), "");
});

test("morphology concatenates abstract prefix and root without surface punctuation", () => {
  assert.equal(realizeMorphs([prefixMorph("esi"), rootMorph("cook")]), "esicook");
});
