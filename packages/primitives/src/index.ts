export * from "./project-resources.js";
export * from "./lexicon.js";
export * from "./morphology-nodes.js";
export * from "./grammar-nodes.js";
export * from "./surface-nodes.js";
export * from "./analysis-nodes.js";
export * from "./compositional-syntax.js";
export * from "./word-realization-nodes.js";
export * from "./phonology-nodes.js";
import type { NodeRegistry } from "../../runtime/src/index.js";
import { registerGrammarPrimitives } from "./grammar-nodes.js";
import { registerMorphologyPrimitives } from "./morphology-nodes.js";
import { registerSurfacePrimitives } from "./surface-nodes.js";
import { registerAnalysisPrimitives } from "./analysis-nodes.js";
import { registerWordRealizationPrimitives } from "./word-realization-nodes.js";
import { registerPhonologyPrimitives } from "./phonology-nodes.js";
import {registerRealizationAuthoring} from "./authoring.js";
export function registerCorePrimitives(registry:NodeRegistry):void { registerGrammarPrimitives(registry); registerMorphologyPrimitives(registry); registerSurfacePrimitives(registry); registerAnalysisPrimitives(registry); registerWordRealizationPrimitives(registry); registerPhonologyPrimitives(registry); registerRealizationAuthoring(registry); }

export * from "./phonology-environment.js";
export * from "./phonology-rules.js";

export * from "./surface-form.js";

export * from "./authoring.js";
