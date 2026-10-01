import type { FeatureBundle, StableId } from "../../core-types/src/index.js";
import type { ProjectResources } from "./project-resources.js";

export interface ValencySlot {
  readonly role: string;
  readonly acceptedTypes: readonly string[];
  readonly required: boolean;
  readonly cardinality: "ONE" | "OPTIONAL" | "MANY";
}

export interface Lexeme {
  readonly id: StableId;
  readonly conceptId: StableId;
  readonly lexicalClass: string;
  readonly forms: Readonly<Record<string, string>>;
  readonly features: FeatureBundle;
  readonly valency: readonly ValencySlot[];
  readonly relatedLexemes: Readonly<Record<string, readonly StableId[]>>;
  readonly irregularRuleIds: readonly StableId[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function findLexemeByConcept(resources: ProjectResources, conceptId: StableId, lexicalClass?: string): Lexeme | undefined {
  for (const id of resources.conceptToLexemeIds[conceptId] ?? []) {
    const lexeme=resources.lexemes[id];
    if (lexeme && (!lexicalClass || lexeme.lexicalClass===lexicalClass)) return lexeme;
  }
  return undefined;
}
