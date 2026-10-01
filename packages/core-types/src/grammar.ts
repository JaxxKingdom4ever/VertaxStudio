import type { FeatureBundle } from "./features.js";
import type { StableId } from "./ids.js";

export interface GrammarStructure {
  readonly id: StableId;
  readonly kind: "Clause" | "Phrase" | "OrderedGroup" | "BoundUnit" | "ArgumentFrame" | "ListStructure" | "DeferredStructure" | "MorphCandidate";
  readonly children: readonly StableId[];
  readonly features: FeatureBundle;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface SurfaceSegment {
  readonly kind: 'Grapheme' | 'Boundary' | 'Punctuation' | 'Space';
  readonly text: string;
  readonly sourceIds: readonly StableId[];
  readonly nodeIds: readonly StableId[];
}
export interface SurfaceForm {
  readonly id: StableId;
  readonly text: string;
  readonly sourceMap?: Readonly<Record<string, readonly StableId[]>>;
  readonly nodeSourceMap?: Readonly<Record<string, readonly StableId[]>>;
  readonly segments?: readonly SurfaceSegment[];
}
