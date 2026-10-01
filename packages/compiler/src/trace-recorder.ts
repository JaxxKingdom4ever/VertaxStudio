import type { CompilerStage, StableId, TraceStep } from "../../core-types/src/index.js";
export function makeTraceStep(args:{step:number;stage:CompilerStage;ruleId?:StableId;graphId?:StableId;nodeIds?:readonly StableId[];scopeId?:StableId;beforeFingerprint?:string;afterFingerprint?:string;reason:string}):TraceStep { return {...args}; }
