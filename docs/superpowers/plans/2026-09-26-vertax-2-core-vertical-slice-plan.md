# Vertax 2 Core Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a headless, deterministic Vertax compiler kernel that compiles a confirmed MeaningGraph through Grammar, Morphology, and Surface into a reference-conlang sentence with typed nodes, scopes, requirements, provenance trace, diagnostics, and regression tests.

**Architecture:** Start as a TypeScript pnpm workspace with a UI-independent compiler core. Semantic and grammar objects are immutable typed data; declarative rules select serializable node graphs; the runtime evaluates typed primitive nodes, manages scopes and deferred requirements, and repeats stage transformations to a fixed point. A small CLI and reference-conlang fixture prove the complete path before any graphical editor is built.

**Tech Stack:** TypeScript, Node.js, pnpm workspaces, Vitest. No React, Tauri, AI, or persistence framework in this plan.

**Spec:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`

## Global Constraints

- Nodes transform typed linguistic objects, not arbitrary strings, until the Surface stage.
- MeaningGraph stores meaning rather than source-language syntax.
- Confirmed MeaningGraph compilation is deterministic: the same project state, MeaningGraph, and compiler settings produce the same result.
- Vertax must report unresolved ambiguity rather than silently choosing between equally valid rules.
- Requirements and scopes are first-class runtime objects.
- Compiler stages complete at a fixed point, not according to visual node placement.
- Recursion must fail safely on repeated no-progress states instead of hanging.
- Every successful transformation records provenance sufficient to trace final output back toward meaning.
- Tables/lexical resources store facts; node graphs/rules store behavior.
- The reference-conlang example must use only generic engine objects and primitives; no source-code branch may special-case that language.
- UI, persistence, Tauri packaging, collaboration, and general natural-language parsing are outside this plan.

## Review Focus

1. **Two equally specific, equally prioritized rules match the same object:** Task 3 must prove compilation returns an `AMBIGUOUS_RULE` diagnostic instead of picking by array order.
2. **A recursive rule keeps matching without changing compiler state:** Task 5 must prove the stage halts with `NO_PROGRESS_RECURSION` instead of hanging.
3. **A Requirement remains open when a stage ends:** Task 5 must prove stage validation returns `UNRESOLVED_REQUIREMENT` and no successful surface result.
4. **A grammatical category is intentionally zero-marked:** Task 6 must prove a `ZeroMorph` is a valid realization that emits no characters without being treated as missing morphology.
5. **Two roles reference the same semantic entity:** Task 1 must prove graph integrity preserves one stable entity ID rather than cloning/rewriting identity.

---

## File Structure Locked by This Plan

```text
vertax/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
├── packages/
│   ├── core-types/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── ids.ts
│   │   │   ├── semantic.ts
│   │   │   ├── features.ts
│   │   │   ├── grammar.ts
│   │   │   ├── morphology.ts
│   │   │   ├── diagnostics.ts
│   │   │   ├── trace.ts
│   │   │   └── index.ts
│   │   └── tests/
│   │       └── semantic.test.ts
│   ├── runtime/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── state.ts
│   │   │   ├── scopes.ts
│   │   │   ├── requirements.ts
│   │   │   ├── matchers.ts
│   │   │   ├── rule-selection.ts
│   │   │   ├── node-registry.ts
│   │   │   ├── graph-executor.ts
│   │   │   ├── fingerprint.ts
│   │   │   └── index.ts
│   │   └── tests/
│   │       ├── scopes-requirements.test.ts
│   │       ├── rule-selection.test.ts
│   │       └── graph-executor.test.ts
│   ├── compiler/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── stage.ts
│   │   │   ├── pipeline.ts
│   │   │   ├── validation.ts
│   │   │   ├── trace-recorder.ts
│   │   │   └── index.ts
│   │   └── tests/
│   │       ├── stage.test.ts
│   │       └── pipeline.test.ts
│   └── primitives/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── project-resources.ts
│       │   ├── lexicon.ts
│       │   ├── grammar-nodes.ts
│       │   ├── morphology-nodes.ts
│       │   ├── surface-nodes.ts
│       │   └── index.ts
│       └── tests/
│           ├── morphology.test.ts
│           └── surface.test.ts
├── apps/
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   └── main.ts
│       └── tests/
│           └── cli.test.ts
└── examples/
    └── reference-slice/
        ├── project.ts
        ├── meanings/
        │   └── who-is-cooking-food.ts
        └── tests/
            └── reference-slice.test.ts
```

The first persistence plan may later replace the in-code example project with serialized project files without changing the compiler interfaces.

---

### Task 1: Workspace and Core Linguistic Types

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `packages/core-types/package.json`
- Create: `packages/core-types/tsconfig.json`
- Create: `packages/runtime/package.json`
- Create: `packages/runtime/tsconfig.json`
- Create: `packages/compiler/package.json`
- Create: `packages/compiler/tsconfig.json`
- Create: `packages/primitives/package.json`
- Create: `packages/primitives/tsconfig.json`
- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `packages/core-types/src/ids.ts`
- Create: `packages/core-types/src/semantic.ts`
- Create: `packages/core-types/src/features.ts`
- Create: `packages/core-types/src/grammar.ts`
- Create: `packages/core-types/src/morphology.ts`
- Create: `packages/core-types/src/diagnostics.ts`
- Create: `packages/core-types/src/trace.ts`
- Create: `packages/core-types/src/index.ts`
- Test: `packages/core-types/tests/semantic.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type StableId = string`
  - `type SemanticType = "Entity" | "Group" | "Event" | "State" | "Property" | "Relation" | "Quantity" | "Proposition" | "Unknown" | "Reference" | "Modality" | "SemanticList"`
  - `interface FeatureBundle { readonly values: Readonly<Record<StableId, unknown>> }`
  - `interface SemanticObject { readonly id: StableId; readonly type: SemanticType; readonly conceptId?: StableId; readonly roles: Readonly<Record<string, readonly StableId[]>>; readonly features: FeatureBundle; readonly provenance?: readonly ProvenanceRef[] }`
  - `interface SemanticGraph { readonly objects: Readonly<Record<StableId, SemanticObject>>; readonly roots: readonly StableId[] }`
  - `interface GrammarStructure`
  - `type Morph = RootMorph | AffixMorph | ZeroMorph`
  - `interface MorphSequence { readonly morphs: readonly Morph[] }`
  - `interface Diagnostic`
  - `interface TraceStep`
  - `function validateSemanticGraph(graph: SemanticGraph): readonly Diagnostic[]`

- [ ] **Step 1: Scaffold the pnpm workspace and TypeScript/Vitest configuration**

Create workspace scripts:

```text
pnpm test
pnpm typecheck
```

Both commands must discover every package created in this plan.

Each workspace package uses ESM, exports its `src/index.ts` entry during development, and references internal packages with `workspace:*`. The root TypeScript configuration provides the shared strict compiler settings.

- [ ] **Step 2: Write the failing semantic graph tests**

In `packages/core-types/tests/semantic.test.ts`, add tests asserting:

```ts
expect(validateSemanticGraph(validGraph)).toEqual([]);
expect(validateSemanticGraph(graphWithMissingRoleTarget)[0]?.code)
  .toBe("MISSING_SEMANTIC_REFERENCE");
expect(validGraph.objects["hunter-1"]).toBe(
  validGraph.objects[
    validGraph.objects["see-1"].roles.agent[0]
  ]
);
```

The third assertion pins stable identity: multiple semantic roles referencing `"hunter-1"` resolve to the one stored entity object rather than copied entities.

- [ ] **Step 3: Run the semantic tests and verify they fail**

Run:

```bash
pnpm vitest packages/core-types/tests/semantic.test.ts --run
```

Expected: FAIL because the core types and `validateSemanticGraph` do not yet exist.

- [ ] **Step 4: Implement the core type modules and `validateSemanticGraph(graph: SemanticGraph): readonly Diagnostic[]`**

`validateSemanticGraph` must check:

- every root ID exists;
- every role target ID exists;
- object IDs are the keys by which identity is preserved.

It must not clone referenced objects or rewrite IDs.

- [ ] **Step 5: Run core tests and typecheck**

Run:

```bash
pnpm vitest packages/core-types/tests/semantic.test.ts --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts packages/*/package.json packages/*/tsconfig.json apps/cli/package.json apps/cli/tsconfig.json packages/core-types
git commit -m "feat: define Vertax core linguistic types"
```

---

### Task 2: Immutable Runtime State, Scopes, and Requirements

**Files:**
- Create: `packages/runtime/src/state.ts`
- Create: `packages/runtime/src/scopes.ts`
- Create: `packages/runtime/src/requirements.ts`
- Create: `packages/runtime/src/index.ts`
- Test: `packages/runtime/tests/scopes-requirements.test.ts`

**Interfaces:**
- Consumes:
  - `SemanticGraph`, `GrammarStructure`, `StableId`, `Diagnostic` from Task 1.
- Produces:
  - `interface RuntimeState`
  - `interface Scope { id: StableId; type: string; parentId?: StableId; childIds: readonly StableId[]; requirementIds: readonly StableId[]; status: "OPEN" | "RESOLVED" | "FAILED" }`
  - `interface Requirement { id: StableId; ownerScopeId: StableId; creatorId: StableId; acceptedTypes: readonly string[]; status: "OPEN" | "RESOLVED" | "FAILED"; resolutionId?: StableId }`
  - `function createRuntimeState(graph: SemanticGraph): RuntimeState`
  - `function openScope(state: RuntimeState, spec: OpenScopeSpec): RuntimeState`
  - `function closeScope(state: RuntimeState, scopeId: StableId): RuntimeState`
  - `function openRequirement(state: RuntimeState, spec: OpenRequirementSpec): RuntimeState`
  - `function resolveRequirement(state: RuntimeState, requirementId: StableId, resolution: CompilerValue): ResolveRequirementResult`

- [ ] **Step 1: Write failing scope/requirement tests**

Cover:

```ts
expect(openScope(initial, child).scopes[child.id].parentId)
  .toBe(initial.currentScopeId);

expect(openRequirement(withChild, req)
  .scopes[child.id].requirementIds)
  .toContain(req.id);

expect(resolveRequirement(withReq, req.id, compatible).state
  .requirements[req.id].status)
  .toBe("RESOLVED");

expect(resolveRequirement(withReq, req.id, incompatible).diagnostics[0]?.code)
  .toBe("REQUIREMENT_TYPE_MISMATCH");
```

Also assert all operations return new state objects and do not mutate the prior state.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm vitest packages/runtime/tests/scopes-requirements.test.ts --run
```

Expected: FAIL because runtime functions do not exist.

- [ ] **Step 3: Implement immutable runtime state and scope operations**

Implement the exact exported signatures above in `state.ts` and `scopes.ts`.

No operation may mutate an existing `RuntimeState`.

- [ ] **Step 4: Implement Requirement creation and resolution**

`resolveRequirement` accepts a candidate only when its compiler type is included by `acceptedTypes`; otherwise it returns the unchanged logical state plus `REQUIREMENT_TYPE_MISMATCH`.

- [ ] **Step 5: Run runtime tests**

Run:

```bash
pnpm vitest packages/runtime/tests/scopes-requirements.test.ts --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime
git commit -m "feat: add scopes and deferred requirements"
```

---

### Task 3: Declarative Matchers and Deterministic Rule Selection

**Files:**
- Create: `packages/runtime/src/matchers.ts`
- Create: `packages/runtime/src/rule-selection.ts`
- Test: `packages/runtime/tests/rule-selection.test.ts`

**Interfaces:**
- Consumes:
  - compiler objects from Tasks 1–2.
- Produces:
  - `type MatcherExpr = TypeMatcher | FeatureEqualsMatcher | RoleExistsMatcher | AllMatcher | AnyMatcher`
  - `interface RuleDefinition { id: StableId; stage: CompilerStage; matcher: MatcherExpr; graphId: StableId; priority: number; fallback: boolean }`
  - `interface MatchResult { matched: boolean; specificity: number }`
  - `function matchObject(expr: MatcherExpr, value: CompilerValue): MatchResult`
  - `function selectRule(rules: readonly RuleDefinition[], value: CompilerValue): RuleSelection`

Specificity is defined for this plan as the count of matched non-wildcard atomic predicates in the normalized matcher. Selection order is:

1. matched rules only;
2. highest specificity;
3. highest numeric `priority`;
4. non-fallback before fallback;
5. if more than one rule still ties, return an ambiguity diagnostic.

- [ ] **Step 1: Write failing matcher and rule-selection tests**

Include:

```ts
expect(matchObject(typeAndFeatureMatcher, pastEvent))
  .toEqual({ matched: true, specificity: 2 });

expect(selectRule([general, specific], pastEvent).rule?.id)
  .toBe(specific.id);

expect(selectRule([sameA, sameB], pastEvent).diagnostics[0]?.code)
  .toBe("AMBIGUOUS_RULE");
```

The ambiguity test must construct rules with the same matcher specificity, priority, and fallback status but different IDs, proving array order does not select a winner.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm vitest packages/runtime/tests/rule-selection.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement the declarative matcher evaluator**

Implement `matchObject` for the matcher variants in the interface block.

No user-supplied JavaScript predicate is permitted in this plan.

- [ ] **Step 4: Implement deterministic `selectRule`**

Use the exact precedence order above and emit `AMBIGUOUS_RULE` on an unresolved tie.

- [ ] **Step 5: Run matcher tests and typecheck**

Run:

```bash
pnpm vitest packages/runtime/tests/rule-selection.test.ts --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/matchers.ts packages/runtime/src/rule-selection.ts packages/runtime/tests/rule-selection.test.ts
git commit -m "feat: add deterministic rule selection"
```

---

### Task 4: Typed Node Registry and Serializable Graph Executor

**Files:**
- Create: `packages/runtime/src/node-registry.ts`
- Create: `packages/runtime/src/graph-executor.ts`
- Test: `packages/runtime/tests/graph-executor.test.ts`

**Interfaces:**
- Consumes:
  - runtime state, compiler values, diagnostics.
- Produces:
  - `interface PortDefinition { id: string; direction: "input" | "output"; acceptedTypes: readonly string[]; cardinality: "ONE" | "OPTIONAL" | "MANY"; required: boolean }`
  - `interface NodeDefinition { typeId: string; inputs: readonly PortDefinition[]; outputs: readonly PortDefinition[]; evaluate(ctx: NodeContext, inputs: Readonly<Record<string, readonly CompilerValue[]>>, params: Readonly<Record<string, unknown>>): NodeEvaluation }`
  - `interface GraphNode { id: StableId; typeId: string; params: Readonly<Record<string, unknown>> }`
  - `interface GraphEdge { sourceNodeId: StableId; sourcePortId: string; targetNodeId: StableId; targetPortId: string }`
  - `interface GraphDefinition { id: StableId; nodes: readonly GraphNode[]; edges: readonly GraphEdge[]; exposedInputs: readonly GraphPortBinding[]; exposedOutputs: readonly GraphPortBinding[] }`
  - `class NodeRegistry { register(definition: NodeDefinition): void; get(typeId: string): NodeDefinition | undefined }`
  - `function executeGraph(graph: GraphDefinition, registry: NodeRegistry, ctx: NodeContext, inputs: Readonly<Record<string, readonly CompilerValue[]>>): GraphExecutionResult`

- [ ] **Step 1: Write failing graph-execution tests**

Register two tiny test node definitions:

- `test.identity`
- `test.set-feature`

Assert a two-node graph passes a typed object through and changes only the requested feature.

Also assert connecting an `Entity`-only port to a `Morph` value returns `PORT_TYPE_MISMATCH`.

- [ ] **Step 2: Run the graph tests and verify they fail**

Run:

```bash
pnpm vitest packages/runtime/tests/graph-executor.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement `NodeRegistry` and port validation**

A node type ID may only be registered once.

Graph execution must validate runtime values against target port accepted types before invoking the target node.

- [ ] **Step 4: Implement data-driven `executeGraph`**

A node becomes ready only when all required input ports have values.

Execution order must be derived from data dependencies, not node coordinates or node-array order.

Direct cyclic edges are rejected in this plan with `CYCLIC_GRAPH_EDGE`; recursion is expressed later through rules/scopes, not raw edge loops.

- [ ] **Step 5: Run graph tests and typecheck**

Run:

```bash
pnpm vitest packages/runtime/tests/graph-executor.test.ts --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/node-registry.ts packages/runtime/src/graph-executor.ts packages/runtime/tests/graph-executor.test.ts
git commit -m "feat: execute typed Vertax node graphs"
```

---

### Task 5: Fixed-Point Stage Compiler, Validation, and Recursion Safety

**Files:**
- Create: `packages/runtime/src/fingerprint.ts`
- Create: `packages/compiler/src/stage.ts`
- Create: `packages/compiler/src/validation.ts`
- Create: `packages/compiler/src/trace-recorder.ts`
- Create: `packages/compiler/src/index.ts`
- Test: `packages/compiler/tests/stage.test.ts`

**Interfaces:**
- Consumes:
  - `RuleDefinition`, `GraphDefinition`, `NodeRegistry`, `RuntimeState`.
- Produces:
  - `interface StageProject { stage: CompilerStage; rules: readonly RuleDefinition[]; graphs: Readonly<Record<StableId, GraphDefinition>> }`
  - `interface CompileStageOptions { maxSteps: number; trace: boolean }`
  - `interface StageResult { state: RuntimeState; values: readonly CompilerValue[]; diagnostics: readonly Diagnostic[]; trace: readonly TraceStep[]; success: boolean }`
  - `function fingerprintStageState(state: RuntimeState, values: readonly CompilerValue[]): string`
  - `function compileStage(project: StageProject, registry: NodeRegistry, state: RuntimeState, values: readonly CompilerValue[], options: CompileStageOptions): StageResult`
  - `function validateStageCompletion(state: RuntimeState): readonly Diagnostic[]`

- [ ] **Step 1: Write failing fixed-point tests**

Test:

1. a matching rule changes an object once, then no longer matches, and the stage succeeds;
2. a rule that returns an identical logical state while continuing to match stops with `NO_PROGRESS_RECURSION`;
3. exceeding `maxSteps` stops with `MAX_STAGE_STEPS_EXCEEDED`;
4. an open Requirement at fixed point produces `UNRESOLVED_REQUIREMENT` and `success === false`.

- [ ] **Step 2: Run stage tests and verify they fail**

Run:

```bash
pnpm vitest packages/compiler/tests/stage.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement canonical state fingerprinting**

`fingerprintStageState` must ignore irrelevant object-key insertion order while preserving semantic IDs, features, scopes, requirements, and current values.

Its purpose is repeat/no-progress detection, not cryptographic security.

- [ ] **Step 4: Implement `compileStage`**

Loop:

```text
validate current values
find matching rules
select deterministic winner
execute its graph
record trace
update runtime/values
stop at fixed point
```

If the pre-step and post-step fingerprints are identical while the same transformation remains applicable, emit `NO_PROGRESS_RECURSION`.

- [ ] **Step 5: Implement stage-completion validation**

`validateStageCompletion` returns `UNRESOLVED_REQUIREMENT` for every open required Requirement.

A stage with any Error/Fatal completion diagnostic is unsuccessful.

- [ ] **Step 6: Run stage tests and typecheck**

Run:

```bash
pnpm vitest packages/compiler/tests/stage.test.ts --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/fingerprint.ts packages/compiler
git commit -m "feat: add fixed-point compiler stages"
```

---

### Task 6: Lexical Resources, Morphology, Zero Morphs, and Surface Primitives

**Files:**
- Create: `packages/primitives/src/project-resources.ts`
- Create: `packages/primitives/src/lexicon.ts`
- Create: `packages/primitives/src/grammar-nodes.ts`
- Create: `packages/primitives/src/morphology-nodes.ts`
- Create: `packages/primitives/src/surface-nodes.ts`
- Create: `packages/primitives/src/index.ts`
- Test: `packages/primitives/tests/morphology.test.ts`
- Test: `packages/primitives/tests/surface.test.ts`

**Interfaces:**
- Consumes:
  - Node registry contract from Task 4.
  - Morph and GrammarStructure types from Task 1.
- Produces:
  - `interface Lexeme { id: StableId; conceptId: StableId; lexicalClass: string; forms: Readonly<Record<string, string>>; relatedLexemeIds: readonly StableId[] }`
  - `interface ProjectResources { lexemes: Readonly<Record<StableId, Lexeme>>; conceptToLexemeIds: Readonly<Record<StableId, readonly StableId[]>>; tables: Readonly<Record<StableId, Readonly<Record<string, unknown>>>> }`
  - `function findLexemeByConcept(resources: ProjectResources, conceptId: StableId, lexicalClass?: string): Lexeme | undefined`
  - `function registerCorePrimitives(registry: NodeRegistry): void`
  - `function rootMorph(form: string): RootMorph`
  - `function prefixMorph(form: string): AffixMorph`
  - `function suffixMorph(form: string): AffixMorph`
  - `function zeroMorph(featureId: StableId): ZeroMorph`
  - `function realizeMorphs(morphs: readonly Morph[]): string`

Required primitive node type IDs in this plan:

```text
grammar.order
grammar.bind
grammar.lookup-lexeme
morph.root
morph.prefix
morph.suffix
morph.zero
surface.join
surface.space
surface.output
```

- [ ] **Step 1: Write failing morphology tests**

Assert:

```ts
expect(realizeMorphs([zeroMorph("present")])).toBe("");
expect(realizeMorphs([prefixMorph("esi"), rootMorph("cook")]))
  .toBe("esicook");
```

The zero-morph test must distinguish a valid `ZeroMorph` from a missing/undefined morph. `realizeMorphs` is only a morphology-layer helper; it does not insert orthographic boundary punctuation.

- [ ] **Step 2: Write failing surface tests**

Build a `BoundUnit` for `person + vo` and assert `surface.join` with separator `'` yields:

```text
person'vo
```

Also assert `surface.space` across four surface units yields:

```text
person'vo duru esi'cook food
```

- [ ] **Step 3: Run primitive tests and verify they fail**

Run:

```bash
pnpm vitest packages/primitives/tests --run
```

Expected: FAIL.

- [ ] **Step 4: Implement lexical lookup and the primitive node definitions**

`registerCorePrimitives` registers the exact type IDs above.

`grammar.bind` must produce a structured `BoundUnit`; it must not insert apostrophes.

`surface.join` is the first layer allowed to realize the apostrophe. The continuous `esi + cook` MorphSequence must therefore remain structurally segmented until Surface can render it as `esi'cook`.

- [ ] **Step 5: Implement morph realization including `ZeroMorph`**

Add the minimal exported helper:

```ts
function realizeMorphs(morphs: readonly Morph[]): string
```

`ZeroMorph` returns an empty contribution but remains present in trace/provenance.

- [ ] **Step 6: Run primitive tests and typecheck**

Run:

```bash
pnpm vitest packages/primitives/tests --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/primitives
git commit -m "feat: add lexical morphology and surface primitives"
```

---

### Task 7: Compiler Pipeline and Provenance Trace

**Files:**
- Create: `packages/compiler/src/pipeline.ts`
- Modify: `packages/compiler/src/trace-recorder.ts`
- Test: `packages/compiler/tests/pipeline.test.ts`

**Interfaces:**
- Consumes:
  - stage compiler from Task 5;
  - primitive registry/resources from Task 6.
- Produces:
  - `interface CompilerProject { grammar: StageProject; morphology: StageProject; surface: StageProject; resources: ProjectResources }`
  - `interface CompileOptions { mode: "fast" | "trace" | "strict"; maxStepsPerStage: number }`
  - `interface CompileResult { success: boolean; surface?: string; diagnostics: readonly Diagnostic[]; trace: readonly TraceStep[]; stageResults: Readonly<Partial<Record<CompilerStage, StageResult>>> }`
  - `function compileMeaningGraph(project: CompilerProject, registry: NodeRegistry, graph: SemanticGraph, options: CompileOptions): CompileResult`

Each `TraceStep` must include:

```text
step
stage
ruleId
graphId
nodeIds
scopeId
beforeFingerprint
afterFingerprint
reason
```

- [ ] **Step 1: Write failing pipeline tests**

Build minimal in-memory stage fixtures and assert:

```ts
expect(result.success).toBe(true);
expect(result.trace.length).toBeGreaterThan(0);
expect(result.trace[0]).toMatchObject({
  stage: "Grammar",
  ruleId: expect.any(String),
  beforeFingerprint: expect.any(String),
  afterFingerprint: expect.any(String),
});
```

Also assert `mode: "fast"` may omit detailed node-level trace payloads while preserving diagnostics.

- [ ] **Step 2: Run pipeline tests and verify they fail**

Run:

```bash
pnpm vitest packages/compiler/tests/pipeline.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement `compileMeaningGraph`**

Execution order is exactly:

```text
validate MeaningGraph
Grammar
Morphology
Surface
```

If a stage fails, later stages do not run.

Strict mode treats unresolved ambiguity and unresolved requirements as failure.

- [ ] **Step 4: Implement trace recording and stage aggregation**

Trace step ordering must be stable across identical runs.

- [ ] **Step 5: Run pipeline tests and typecheck**

Run:

```bash
pnpm vitest packages/compiler/tests/pipeline.test.ts --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/compiler/src/pipeline.ts packages/compiler/src/trace-recorder.ts packages/compiler/tests/pipeline.test.ts
git commit -m "feat: compile MeaningGraphs through Vertax stages"
```

---

### Task 8: Reference-Conlang Vertical Slice

**Files:**
- Create: `examples/reference-slice/project.ts`
- Create: `examples/reference-slice/meanings/who-is-cooking-food.ts`
- Create: `examples/reference-slice/tests/reference-slice.test.ts`

**Interfaces:**
- Consumes:
  - all public interfaces from Tasks 1–7.
- Produces:
  - `export const referenceSliceProject: CompilerProject`
  - `export const whoIsCookingFood: SemanticGraph`
  - a regression fixture proving the approved architecture can express a real unusual grammar without core-engine special cases.

The semantic input represents:

```text
Event: COOK
agent → Unknown(expected_type=Person)
theme → FOOD
aspect → continuous
```

The expected surface is exactly:

```text
person'vo duru esi'cook food
```

- [ ] **Step 1: Write the failing reference-slice test**

```ts
const registry = new NodeRegistry();
registerCorePrimitives(registry);

const result = compileMeaningGraph(
  referenceSliceProject,
  registry,
  whoIsCookingFood,
  { mode: "trace", maxStepsPerStage: 100 }
);

expect(result.success).toBe(true);
expect(result.surface)
  .toBe("person'vo duru esi'cook food");
expect(result.diagnostics.filter(d => d.severity === "Error"))
  .toHaveLength(0);
```

Also assert the trace contains at least one binding step and one morphology step.

- [ ] **Step 2: Run the reference test and verify it fails**

Run:

```bash
pnpm vitest examples/reference-slice/tests/reference-slice.test.ts --run
```

Expected: FAIL because the example project/rules are not implemented.

- [ ] **Step 3: Build the example grammar using only public rule, graph, node, lexicon, feature, and resource APIs**

The example may define language-specific rules and graphs inside `examples/reference-slice/project.ts`.

It must not modify `packages/runtime`, `packages/compiler`, or `packages/primitives` to recognize the reference language.

- [ ] **Step 4: Run the reference test**

Run:

```bash
pnpm vitest examples/reference-slice/tests/reference-slice.test.ts --run
```

Expected: PASS with surface exactly `person'vo duru esi'cook food`.

- [ ] **Step 5: Run the complete workspace test suite**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/reference-slice
git commit -m "test: prove Vertax core with reference conlang"
```

---

### Task 9: Minimal CLI for Headless Compilation and Trace Inspection

**Files:**
- Create: `apps/cli/src/main.ts`
- Create: `apps/cli/tests/cli.test.ts`
- Modify: root `package.json`

**Interfaces:**
- Consumes:
  - `referenceSliceProject`
  - `compileMeaningGraph`
- Produces:
  - CLI commands:
    - `vertax-demo compile`
    - `vertax-demo trace`
  - root script:
    - `pnpm demo`

For this plan the CLI may compile the bundled reference fixture only; generic project-file loading belongs to the persistence plan.

- [ ] **Step 1: Write the failing CLI tests**

Assert:

```text
vertax-demo compile
```

prints exactly:

```text
person'vo duru esi'cook food
```

to stdout with exit code `0`.

Assert:

```text
vertax-demo trace
```

prints the final surface plus at least the stage names:

```text
Grammar
Morphology
Surface
```

- [ ] **Step 2: Run CLI tests and verify they fail**

Run:

```bash
pnpm vitest apps/cli/tests/cli.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement the CLI entry point**

`compile` uses fast mode.

`trace` uses trace mode and prints a concise ordered trace after the final surface.

Any Error/Fatal diagnostic exits non-zero.

- [ ] **Step 4: Run CLI tests**

Run:

```bash
pnpm vitest apps/cli/tests/cli.test.ts --run
pnpm demo
```

Expected: PASS; `pnpm demo` prints `person'vo duru esi'cook food`.

- [ ] **Step 5: Run final verification**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected: all tests and typechecks pass.

- [ ] **Step 6: Commit**

```bash
git add apps/cli package.json
git commit -m "feat: add Vertax headless demo CLI"
```

---

## End State of This Plan

After these tasks, Vertax will have no graphical editor yet, but it will already be real software rather than a mockup:

```text
confirmed MeaningGraph
→ typed deterministic rules
→ serializable node graph execution
→ scopes / requirements
→ fixed-point compilation
→ morphology
→ surface
→ provenance trace
→ diagnostics
→ regression test
→ CLI output
```

The reference conlang must compile:

```text
Unknown(Person) + COOK(continuous) + FOOD
```

to:

```text
person'vo duru esi'cook food
```

without any reference-language-specific branch inside the Vertax engine.

That proves the core architecture before the expensive Studio UI is built.
