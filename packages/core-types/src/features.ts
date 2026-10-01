import type { StableId } from "./ids.js";

export interface FeatureBundle {
  readonly values: Readonly<Record<StableId, unknown>>;
}

export interface FeatureDefinition {
  readonly id: StableId;
  readonly label: string;
  readonly allowedValues: readonly string[];
  readonly defaultValue?: string;
  readonly allowedOn: readonly string[];
  readonly inheritance: "none" | "copy" | "scope";
}
