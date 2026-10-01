import type { CompilerStage, CompilerValue, Diagnostic, StableId } from "../../core-types/src/index.js";
import { matchObject, type MatcherExpr } from "./matchers.js";

export interface RuleDefinition {
  readonly id: StableId;
  readonly stage: CompilerStage;
  readonly matcher: MatcherExpr;
  readonly graphId: StableId;
  readonly priority: number;
  readonly fallback: boolean;
}

export interface RuleSelection {
  readonly rule?: RuleDefinition;
  readonly diagnostics: readonly Diagnostic[];
}

export function selectRule(rules: readonly RuleDefinition[], value: CompilerValue): RuleSelection {
  const candidates = rules.map(rule => ({ rule, match: matchObject(rule.matcher, value) })).filter(x => x.match.matched);
  if (!candidates.length) return { diagnostics: [] };
  const maxSpecificity = Math.max(...candidates.map(x => x.match.specificity));
  let narrowed = candidates.filter(x => x.match.specificity === maxSpecificity);
  const maxPriority = Math.max(...narrowed.map(x => x.rule.priority));
  narrowed = narrowed.filter(x => x.rule.priority === maxPriority);
  if (narrowed.some(x => !x.rule.fallback)) narrowed = narrowed.filter(x => !x.rule.fallback);
  if (narrowed.length === 1) return { rule: narrowed[0]!.rule, diagnostics: [] };
  return {
    diagnostics: [{
      severity: "Error",
      code: "AMBIGUOUS_RULE",
      message: `Rules ${narrowed.map(x => x.rule.id).sort().join(", ")} are equally applicable.`
    }]
  };
}
