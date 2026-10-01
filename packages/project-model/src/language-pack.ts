import type { Diagnostic } from "../../core-types/src/index.js";
import type { ConceptDefinition } from "../../primitives/src/index.js";

/** Shared concepts have stable semantic IDs; translated labels are not structural differences. */
export function validateSharedSemantics(
  source: Readonly<Record<string,ConceptDefinition>>,
  target: Readonly<Record<string,ConceptDefinition>>
): readonly Diagnostic[] {
  const diagnostics:Diagnostic[]=[];
  for(const [id,concept] of Object.entries(source)){
    if(!id.startsWith("sem:")||!target[id])continue;
    if(concept.semanticType!==target[id]!.semanticType)diagnostics.push({
      severity:"Error",code:"SHARED_CONCEPT_MISMATCH",objectId:id,
      message:`Shared concept ${id} has conflicting semantic types ${concept.semanticType??"unspecified"} and ${target[id]!.semanticType??"unspecified"}.`
    });
  }
  return diagnostics;
}