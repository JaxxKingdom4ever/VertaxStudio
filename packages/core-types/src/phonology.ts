import type { StableId } from "./ids.js";

export type PhonologicalToken =
  | { readonly kind: "Phoneme"; readonly symbol: string; readonly sourceMorphId?: StableId; readonly sourceObjectId?: StableId }
  | { readonly kind: "Boundary"; readonly boundary: "Morpheme" | "Affix" | "Syllable" | "Word"; readonly sourceMorphId?: StableId }
  | { readonly kind: "Stress"; readonly level: "Primary" | "Secondary"; readonly sourceMorphId?: StableId };
export interface PhonologicalForm {
  readonly valueType: "PhonologicalForm";
  readonly id: StableId;
  readonly tokens: readonly PhonologicalToken[];
  readonly zeroMorphIds: readonly StableId[];
}
