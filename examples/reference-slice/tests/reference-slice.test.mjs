import test from "node:test";
import assert from "node:assert/strict";
import { NodeRegistry } from "../../../dist/packages/runtime/src/index.js";
import { registerCorePrimitives } from "../../../dist/packages/primitives/src/index.js";
import { compileMeaningGraph } from "../../../dist/packages/compiler/src/index.js";
import { referenceSliceProject, registerReferenceSliceNodes } from "../../../dist/examples/reference-slice/project.js";
import { whoIsCookingFood } from "../../../dist/examples/reference-slice/meanings/who-is-cooking-food.js";

test("reference conlang compiles interrogative continuous event without engine special cases",()=>{
 const registry=new NodeRegistry(); registerCorePrimitives(registry); registerReferenceSliceNodes(registry);
 const result=compileMeaningGraph(referenceSliceProject,registry,whoIsCookingFood,{mode:"trace",maxStepsPerStage:100});
 assert.equal(result.success,true);
 assert.equal(result.surface,"person'vo duru esi'cook food");
 assert.equal(result.diagnostics.filter(d=>d.severity==="Error").length,0);
 assert.ok(result.trace.some(s=>s.ruleId==="ref.bind-question-agent"));
 assert.ok(result.trace.some(s=>s.stage==="Morphology"));
});
