import type { CompilerStage, StableId } from "../../core-types/src/index.js";
import type { DecodeResult } from "./model.js";
export interface PersistedTestDocument {
  readonly schema_version:1; readonly id:StableId; readonly name:string; readonly input_stage:CompilerStage; readonly input:unknown;
  readonly expected_stage:CompilerStage; readonly expected_output:unknown; readonly mode:"fast"|"trace"|"strict"; readonly assertions:readonly Readonly<Record<string,unknown>>[];
}
const stages=new Set<CompilerStage>(["Meaning","Grammar","Morphology","Phonology","Surface","Utility","OrthographyAnalysis","MorphologyAnalysis","GrammarAnalysis","MeaningAnalysis"]);
function rec(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v)}
function str(v:unknown):v is string{return typeof v==="string"}
export function decodePersistedTestDocument(raw:unknown):DecodeResult<PersistedTestDocument>{
  if(!rec(raw)||raw.schema_version!==1||!str(raw.id)||!str(raw.name)||!stages.has(raw.input_stage as CompilerStage)||!stages.has(raw.expected_stage as CompilerStage)||!(["fast","trace","strict"] as unknown[]).includes(raw.mode)||!Array.isArray(raw.assertions)||!raw.assertions.every(rec)||!("input" in raw)||!("expected_output" in raw)) return {diagnostics:[{severity:"Error",code:"INVALID_PERSISTED_TEST",message:"Persisted test document is invalid."}]};
  return {value:raw as unknown as PersistedTestDocument,diagnostics:[]};
}
