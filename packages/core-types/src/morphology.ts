import type { FeatureBundle } from "./features.js";
import type { StableId } from "./ids.js";

/** Morphological structure is deliberately independent of orthographic spelling. */
export type MorphRealizationState = "Abstract" | "Selected" | "Realized" | "Zero";
interface BaseMorph {
  readonly id: StableId;
  readonly features: FeatureBundle;
  readonly boundaryBefore?: string;
  readonly sourceObjectId?: StableId;
  /** Multiple source IDs survive fusion and reduplication. */
  readonly sourceIds?: readonly StableId[];
  readonly meaningId?: StableId;
  readonly realizationState?: MorphRealizationState;
}
export interface RootMorph extends BaseMorph { readonly kind: "Root"; readonly form: string; }
export interface AffixMorph extends BaseMorph {
  readonly kind: "Affix";
  readonly position: "Prefix" | "Suffix";
  readonly form: string;
  /** Shared ID of the two halves of an authored circumfix. */
  readonly pairId?: StableId;
}
export interface ZeroMorph extends BaseMorph { readonly kind: "Zero"; readonly featureId: StableId; }
export type Morph = RootMorph | AffixMorph | ZeroMorph;
export interface MorphSequence { readonly id: StableId; readonly morphs: readonly Morph[]; }
