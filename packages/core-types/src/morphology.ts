import type { FeatureBundle } from "./features.js";
import type { StableId } from "./ids.js";

interface BaseMorph {
  readonly id: StableId;
  readonly features: FeatureBundle;
  readonly boundaryBefore?: string;
  readonly sourceObjectId?: StableId;
}
export interface RootMorph extends BaseMorph { readonly kind: "Root"; readonly form: string; }
export interface AffixMorph extends BaseMorph { readonly kind: "Affix"; readonly position: "Prefix" | "Suffix"; readonly form: string; }
export interface ZeroMorph extends BaseMorph { readonly kind: "Zero"; readonly featureId: StableId; }
export type Morph = RootMorph | AffixMorph | ZeroMorph;
export interface MorphSequence { readonly id: StableId; readonly morphs: readonly Morph[]; }
