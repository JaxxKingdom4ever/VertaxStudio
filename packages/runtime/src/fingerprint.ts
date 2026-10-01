import type { CompilerValue } from "../../core-types/src/index.js";
import type { RuntimeState } from "./state.js";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)]));
  }
  return value;
}
export function fingerprintStageState(state: RuntimeState, values: readonly CompilerValue[]): string {
  return JSON.stringify(normalize({state,values}));
}
