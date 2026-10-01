import { compilerValueType, type CompilerValue, type StableId } from "../../core-types/src/index.js";

export interface TypeMatcher { readonly kind: "type"; readonly type: string; }
export interface FeatureEqualsMatcher { readonly kind: "featureEquals"; readonly featureId: StableId; readonly value: unknown; }
export interface RoleExistsMatcher { readonly kind: "roleExists"; readonly role: string; }
export interface AllMatcher { readonly kind: "all"; readonly matchers: readonly MatcherExpr[]; }
export interface AnyMatcher { readonly kind: "any"; readonly matchers: readonly MatcherExpr[]; }
export type MatcherExpr = TypeMatcher | FeatureEqualsMatcher | RoleExistsMatcher | AllMatcher | AnyMatcher;

export interface MatchResult { readonly matched: boolean; readonly specificity: number; }

function featureValue(value: CompilerValue, id: StableId): unknown {
  if ("features" in value) return value.features.values[id];
  return undefined;
}

export function matchObject(expr: MatcherExpr, value: CompilerValue): MatchResult {
  switch (expr.kind) {
    case "type": return { matched: compilerValueType(value) === expr.type, specificity: compilerValueType(value) === expr.type ? 1 : 0 };
    case "featureEquals": {
      const matched = Object.is(featureValue(value, expr.featureId), expr.value);
      return { matched, specificity: matched ? 1 : 0 };
    }
    case "roleExists": {
      const matched = "roles" in value && Array.isArray(value.roles[expr.role]) && value.roles[expr.role]!.length > 0;
      return { matched, specificity: matched ? 1 : 0 };
    }
    case "all": {
      const results = expr.matchers.map(m => matchObject(m, value));
      if (results.some(r => !r.matched)) return { matched: false, specificity: 0 };
      return { matched: true, specificity: results.reduce((n, r) => n + r.specificity, 0) };
    }
    case "any": {
      const results = expr.matchers.map(m => matchObject(m, value)).filter(r => r.matched);
      if (!results.length) return { matched: false, specificity: 0 };
      return { matched: true, specificity: Math.max(...results.map(r => r.specificity)) };
    }
  }
}
