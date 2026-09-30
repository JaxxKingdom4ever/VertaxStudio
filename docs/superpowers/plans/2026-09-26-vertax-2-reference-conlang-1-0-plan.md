# Vertax 2 Reference Conlang Acceptance + 1.0 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Vertax 1.0 by encoding the current reference conlang entirely as persisted Vertax data and Node Groups, eliminate the remaining language-specific source-code nodes, complete the missing generic grammar/runtime primitives, and harden the project so the reference acceptance corpus is deterministic, safe, authorable, and runnable from Studio/CLI.

**Architecture:** Persisted Node Groups become executable `NodeDefinition`s over the normal graph runtime; the runtime gains branch-safe execution plus generic feature/list/scope/requirement/data primitives rather than conlang-specific helpers. The reference language lives in a real `examples/reference-language.vertax/` project whose graphs, Node Groups, lexicon, tables, and persisted tests exercise the complete language feature set. Vertax core must not import or branch on reference-language IDs.

**Tech Stack:** TypeScript, Node.js built-in test runner, npm workspaces, native DOM/SVG Studio, human-readable `.vertax` JSON.

**Spec:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`

## Global Constraints

- Vertax is a language compiler whose programming language is a node graph.
- Deterministic compilation remains authoritative after MeaningGraph confirmation; AI/parser behavior is outside this phase.
- The reference conlang may use only normal engine types, features, bindings, lists, scopes, requirements, rules, lexicon data, morphology, phonology, Surface, and persisted Node Groups.
- No compiler/runtime/source branch may special-case a reference-language concept, word, morpheme, feature, or node ID.
- Rule precedence remains specificity → numeric priority → non-fallback; unresolved ties are errors.
- Node Groups must execute through the same typed graph executor as built-in nodes.
- Existing Phase 1–5 projects remain loadable; Phonology remains optional for older projects.
- Stable IDs are authoritative; names remain editable display data.
- Logic and layout remain separately persisted.
- Facts belong in lexicons/tables; graph nodes contain logic.
- Tests must continue using npm workspaces + TypeScript + Node's built-in test runner; add no external runtime dependencies.
- Existing output `person'vo duru esi'cook food` must remain unchanged.
- Version 1.0 remains limited to the approved scope; do not add arbitrary-language semantic parsing, cloud sync, collaboration, marketplaces, speech synthesis, historical evolution, or unrestricted scripting.

## Review Focus

1. **Nested Node Group recursion:** direct or indirect self-recursion must terminate with a structured diagnostic instead of hanging or overflowing the JavaScript stack. Task 1 adds a depth/cycle regression.
2. **Inactive branches:** a false/empty conditional branch must be skipped without being reported as a graph dependency cycle, while a real edge cycle must still be diagnosed. Task 2 adds both cases.
3. **Unresolved scope obligations:** a scope must not successfully close with an OPEN Requirement owned by that scope. Task 3 pins the diagnostic and state behavior.
4. **Reference-language leakage:** the final registry/compiler source must contain no `ref.*` executable node types or branches on reference concepts/morphemes. Task 8 adds a source/registry guard.
5. **Determinism under repeated execution:** the complete acceptance corpus must produce byte-identical Surface output and stable trace order across repeated runs. Task 8 adds repeated-run determinism coverage.

---

## File Structure

### Runtime / compiler infrastructure
- Modify `packages/runtime/src/node-registry.ts` — Node Group execution context and nested-call metadata.
- Modify `packages/runtime/src/graph-executor.ts` — distinguish inactive branches from genuine dependency cycles.
- Modify `packages/runtime/src/scopes.ts` and `packages/runtime/src/requirements.ts` — query helpers and safe scope resolution.
- Modify `packages/runtime/src/index.ts` — export new generic runtime helpers.
- Create `packages/project-model/src/node-group-runtime.ts` — adapt persisted Node Groups into executable node definitions.
- Modify `packages/project-model/src/index.ts` — export Node Group runtime adapter.
- Modify `packages/project-model/src/compiler-adapter.ts` — expose the loaded project independently of executable registry composition; no reference-language knowledge.

### Generic authoring primitives
- Create `packages/primitives/src/feature-nodes.ts` — read/set/copy/remove/default features.
- Create `packages/primitives/src/list-nodes.ts` — create/append/prepend/head/tail/reverse/length/push/pop list operations.
- Create `packages/primitives/src/scope-nodes.ts` — open/close/current/parent scope and Requirement operations.
- Create `packages/primitives/src/match-nodes.ts` — generic type/concept/feature/role/impersonal filtering.
- Create `packages/primitives/src/data-nodes.ts` — table lookup, lexeme form/related lexeme/valency operations.
- Modify `packages/primitives/src/grammar-nodes.ts` — generic extract/group/wrap/conjoin/argument-order helpers.
- Modify `packages/primitives/src/index.ts` — register/export all 1.0 primitives.

### Reference language
- Create `examples/reference-language.vertax/` — canonical persisted 1.0 acceptance project.
- Create `examples/reference-language/fixtures.ts` — test-only MeaningGraphs and expected outputs/structures; no executable grammar logic.
- Create `examples/reference-language/acceptance.test.mjs` — feature-by-feature persisted acceptance corpus.
- Modify/remove `examples/reference-slice/project.ts` reference-specific node implementations after migration.
- Modify `examples/reference-slice/persisted-project.ts` and Studio fixtures to load/use the canonical project or retain only a compatibility smoke fixture.

### Studio / CLI 1.0 authoring and test runner
- Create `apps/studio/src/resource-editor.ts` — Lexicon and Data Table workspaces.
- Create `apps/studio/src/node-group-transfer.ts` — browser import/export for a single Node Group document.
- Modify `apps/studio/src/project-tree.ts`, `app.ts`, `workspace-routing.ts`, `studio.css` — route and render resource workspaces accessibly.
- Modify `packages/studio-model/src/model.ts`, `project-session.ts` — `Lexicon` / `Tables` workspaces and immutable resource edits.
- Modify `apps/cli/src/main.ts` — `test-project <path>` command for persisted project tests.
- Create `apps/cli/tests/reference-language.test.mjs` — CLI validation/test acceptance.

---

### Task 1: Make Persisted Node Groups Executable

**Files:**
- Create: `packages/project-model/src/node-group-runtime.ts`
- Modify: `packages/project-model/src/node-groups.ts`
- Modify: `packages/project-model/src/index.ts`
- Modify: `packages/runtime/src/node-registry.ts`
- Test: `packages/project-model/tests/node-group-runtime.test.mjs`

**Interfaces:**
- Consumes: `NodeGroupDocument`, `GraphDefinition`, `NodeRegistry`, `NodeContext`, `executeGraph()`.
- Produces:
  - `nodeGroupTypeId(groupId: StableId): string` returning exactly `node-group:<groupId>`.
  - `registerPersistedNodeGroups(registry: NodeRegistry, groups: Readonly<Record<StableId, NodeGroupDocument>>, options?: { maxDepth?: number }): void`.
  - `NodeContext.nodeGroupParams?: Readonly<Record<string, unknown>>`.
  - `NodeContext.nodeGroupStack?: readonly StableId[]`.
  - Node Group parameter references inside internal node params use the generic JSON sentinel `{ "$groupParam": "<parameter-id>" }`; the adapter recursively substitutes these before executing the internal graph.

- [ ] **Step 1: Write failing Node Group execution tests**

Test that a persisted group with typed input/output and an internal `grammar.order` graph registers as `node-group:<id>`, executes through `executeGraph`, applies declared/default parameters through `nodeGroupParams`, and preserves normal port validation.

Add a nested-group test and a direct/indirect recursion test asserting diagnostic code `NODE_GROUP_RECURSION_LIMIT` rather than a thrown stack overflow.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run build && node --test packages/project-model/tests/node-group-runtime.test.mjs`
Expected: FAIL because persisted Node Groups are not executable/registered.

- [ ] **Step 3: Implement the runtime adapter**

Wrap each `NodeGroupDocument` as a normal `NodeDefinition`; merge required/default instance parameters; recursively substitute `{ "$groupParam": "id" }` sentinels in internal node params; execute `internal_graph` with the same registry and a pushed Node Group stack; map graph inputs/outputs directly from the document's exposed interface. No compiler special case.

- [ ] **Step 4: Verify GREEN and full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/project-model packages/runtime
git commit -m "feat: execute persisted node groups"
```

---

### Task 2: Branch-Safe Graph Execution and Generic Match/Transform Primitives

**Files:**
- Modify: `packages/runtime/src/graph-executor.ts`
- Create: `packages/primitives/src/match-nodes.ts`
- Modify: `packages/primitives/src/grammar-nodes.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/runtime/tests/branch-execution.test.mjs`
- Test: `packages/primitives/tests/grammar-control.test.mjs`

**Interfaces:**
- Consumes: normal optional/required graph ports and `CompilerValue` types.
- Produces generic nodes:
  - `match.type`, `match.concept`, `match.feature`, `match.role-exists`, `match.impersonal` — input `value`, optional output `matched`.
  - `grammar.extract-role` — semantic input + `role` parameter → MANY semantic values.
  - `grammar.group` / `grammar.wrap` / `grammar.conjoin` — generic `GrammarStructure` construction with no language IDs.
  - Graph executor semantics: once every upstream producer for a node has terminated, a node missing required input is marked **inactive/skipped**; only an unresolved dependency strongly connected component is `CYCLIC_GRAPH_EDGE`.

- [ ] **Step 1: Write failing branch-execution tests**

Test a false filter feeding a required downstream input: graph completes with no output and no cycle diagnostic. Test a real A↔B dependency cycle still produces `CYCLIC_GRAPH_EDGE`. Test an absent required *graph input* produces `MISSING_REQUIRED_GRAPH_INPUT` rather than silent skipping.

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test packages/runtime/tests/branch-execution.test.mjs packages/primitives/tests/grammar-control.test.mjs`
Expected: current executor reports a cycle for the inactive branch and match primitives are missing.

- [ ] **Step 3: Implement branch-safe scheduling and primitives**

Track executed vs skipped nodes; a node is skippable only when every incoming producer is terminal and a required port has no value. Preserve deterministic node-ID ordering for runnable nodes.

- [ ] **Step 4: Verify GREEN and full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime packages/primitives
git commit -m "feat: add branch-safe grammar control"
```

---

### Task 3: Features, Lists, Scopes, Requirements, Lexicon, and Table Primitives

**Files:**
- Create: `packages/primitives/src/feature-nodes.ts`
- Create: `packages/primitives/src/list-nodes.ts`
- Create: `packages/primitives/src/scope-nodes.ts`
- Create: `packages/primitives/src/data-nodes.ts`
- Modify: `packages/runtime/src/scopes.ts`
- Modify: `packages/runtime/src/requirements.ts`
- Modify: `packages/runtime/src/index.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/primitives/tests/structural-primitives.test.mjs`
- Test: `packages/runtime/tests/scope-hardening.test.mjs`

**Interfaces:**
- Produces feature nodes: `feature.read`, `feature.set`, `feature.copy`, `feature.remove`, `feature.default`.
- Produces list nodes over `GrammarStructure(kind="ListStructure")`: `list.create`, `list.append`, `list.prepend`, `list.head`, `list.tail`, `list.reverse`, `list.length`, `list.push`, `list.pop`. `list.length` emits a semantic `Quantity` value with numeric feature `value`.
- Produces scope nodes: `scope.open`, `scope.close` as state-changing pass-through nodes; `scope.current` / `scope.parent` emit generic `DeferredStructure` handles containing only scope metadata.
- Produces requirement nodes: `requirement.open` and `requirement.resolve` are state-changing pass-through nodes; `requirement.current` emits a generic `DeferredStructure` handle; `requirement.can-resolve` filters a proposed resolution through the runtime type check without changing state. Dynamic requirement IDs are deterministically derived from node ID + owning scope unless an explicit ID parameter is supplied.
- Produces data nodes: `table.lookup`, `lexicon.get-form`, `lexicon.get-related`, `lexicon.read-valency`.
- Runtime helper: `openRequirementsForScope(state, scopeId): readonly Requirement[]`.
- Safe close API: `tryCloseScope(state, scopeId): { state: RuntimeState; diagnostics: readonly Diagnostic[] }` rejects OPEN owned Requirements using `UNRESOLVED_SCOPE_REQUIREMENT`.

- [ ] **Step 1: Write failing structural primitive tests**

Cover recursive list head/tail reconstruction, feature copy/default behavior, scope open→nested open→resolve→return, Requirement type checking, lexicon related-family lookup, valency read, and table lookup with a missing-row optional output.

Add the Review Focus test: closing a scope with an OPEN owned Requirement leaves the scope OPEN and emits `UNRESOLVED_SCOPE_REQUIREMENT`; resolving it then permits close.

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test packages/primitives/tests/structural-primitives.test.mjs packages/runtime/tests/scope-hardening.test.mjs`
Expected: new primitives/helpers are missing.

- [ ] **Step 3: Implement generic primitives**

All values remain immutable. Lists store real member values in `data.members` plus stable child IDs. Scope/Requirement nodes mutate only `RuntimeState` returned from their node evaluation. Data nodes read `ProjectResources`; they never embed reference-language facts.

- [ ] **Step 4: Verify GREEN and full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/primitives packages/runtime
git commit -m "feat: add structural language primitives"
```

---

### Task 4: Canonical Persisted Reference Language — Core Clause, Tense, Aspect, Relations, and Conjoining

**Files:**
- Create: `examples/reference-language.vertax/project.json`
- Create: `examples/reference-language.vertax/concepts/concepts.json`
- Create: `examples/reference-language.vertax/features/features.json`
- Create: `examples/reference-language.vertax/lexicon/lexicon.json`
- Create: `examples/reference-language.vertax/tables/*.json`
- Create: `examples/reference-language.vertax/graphs/{Grammar,Morphology,Phonology,Surface}/*.json`
- Create: `examples/reference-language.vertax/node-groups/*.json`
- Create: `examples/reference-language.vertax/layouts/*.json`
- Create: `examples/reference-language/fixtures.ts`
- Create: `examples/reference-language/acceptance.test.mjs`

**Interfaces:**
- Consumes: only built-in node definitions plus `node-group:*` definitions registered from this project's persisted Node Groups.
- Produces canonical project data for:
  - SVO/argument ordering and the existing question sentence.
  - past `-in/-min`, future `-as/-mas`, present zero morphology.
  - continuous `es-/esi-`, complete `in-/ino-`, neutral zero aspect.
  - relational-verb families represented by data tables, not runtime branches.
  - multiple copular/relational lexemes (`defo`, `orin`, `duru`) as lexicon/data choices.
  - semantic conjoining as a generic binding/Node Group.

- [ ] **Step 1: Write failing persisted acceptance tests**

Load the project from disk, validate it, register only core primitives + persisted Node Groups, adapt to `CompilerProject`, then test at least: present/continuous question → `person'vo duru esi'cook food`; one past case; one future case; continuous vs complete aspect; one relational-verb family selection; each copular relation; and a conjoined semantic unit.

Every test must start from a MeaningGraph fixture; no test may call reference-language source functions to realize grammar.

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test examples/reference-language/acceptance.test.mjs`
Expected: project/Node Groups do not yet exist or cannot express the cases.

- [ ] **Step 3: Author the persisted language project**

Keep grammatical choices in graphs/Node Groups and lexical/morphological mappings in tables/lexicon. English placeholder content roots are acceptable where the conlang vocabulary is not defined; grammatical morphemes and established forms use the known reference forms.

- [ ] **Step 4: Verify GREEN and round-trip**

Run: `npm test`
Expected: all tests pass, including save→load→validate→compile round-trip of the canonical project.

- [ ] **Step 5: Commit**

```bash
git add examples/reference-language.vertax examples/reference-language
git commit -m "feat: encode reference language core in Vertax"
```

---

### Task 5: Complement Calls, Nested Resolution, Conditionals, Impersonal Behavior, and Negation Transfer

**Files:**
- Create/Modify: `examples/reference-language.vertax/node-groups/complement-call.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/clause-resolver.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/conditional.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/negation-transfer.json`
- Modify: relevant Grammar/Morphology graphs and tables under `examples/reference-language.vertax/`
- Modify: `examples/reference-language/fixtures.ts`
- Test: `examples/reference-language/acceptance.test.mjs`

**Interfaces:**
- Complement Call opens a typed Requirement owned by a Complement scope; nested complements resolve deepest-first then return to the parent scope.
- Conditional behavior uses feature/scope logic and persisted suffix mappings; impersonal conditionals operate on the verb when no personal subject is present.
- Negation/CACS-style transfer is represented as feature propagation/binding policy inside a Node Group/table, not a compiler branch.

- [ ] **Step 1: Add failing feature tests**

Cover a basic complement-call clause, a two-level nested complement resolution, a normal conditional suffix case, an impersonal conditional case, and a negation-transfer case. Assert both final Surface output where forms are established and trace/scope/Requirement structure where lexical surface wording is intentionally placeholder-based.

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test examples/reference-language/acceptance.test.mjs`
Expected: new feature cases fail while Task 4 cases remain green.

- [ ] **Step 3: Author Node Groups and data**

Use `scope.*`, `requirement.*`, feature, binding, list, morphology, and Surface primitives. No new `ref.*` NodeDefinition may be introduced.

- [ ] **Step 4: Verify GREEN and full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add examples/reference-language.vertax examples/reference-language
git commit -m "feat: encode recursive clause mechanics"
```

---

### Task 6: Possession, Interrogatives, Coordination, Modality, Comparison, Coreference, Ditransitives, and Deixis

**Files:**
- Create/Modify: `examples/reference-language.vertax/node-groups/recursive-possession.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/interrogative-search.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/coordination.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/comparison.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/coreference.json`
- Create/Modify: `examples/reference-language.vertax/node-groups/relational-deixis.json`
- Modify: reference graphs/lexicon/tables/tests.
- Test: `examples/reference-language/acceptance.test.mjs`

**Interfaces:**
- Recursive possession and possessive trails use `ListStructure` plus `PossessionRecursion` scopes; no fixed chain depth.
- `vo` is an attachment-sensitive interrogative-search Node Group usable on entities and relations.
- Dynamic coordination consumes/produces explicit list tails rather than a fixed binary conjunction form.
- Scalar modality is table/feature driven; this task does not hard-code lexical semantics into runtime.
- Comparison supports `-pu`, `-mo`, `-ga` comparative marking and attachment-sensitive superlative marking through graph placement.
- `kizo` / `oda` resolve through reference/group features and generic coreference binding.
- Ditransitives order Agent → Recipient → Verb → Theme from valency/roles.
- Deixis and semantic definiteness arise from explicit Relation/binding structure rather than English-style articles.

- [ ] **Step 1: Add failing acceptance cases for every remaining 1.0 language feature**

At minimum cover recursive possession depth 4, possession trail, entity `vo`, relational `vo`, zero-marked imperative, 3-item dynamic coordination tail, low/high scalar modality examples, more/less/equal comparison, superlative attachment, same-group and other-group references, ditransitive order, near/far relational deixis, and semantic definiteness.

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test examples/reference-language/acceptance.test.mjs`
Expected: new cases fail for missing project-authored behavior.

- [ ] **Step 3: Author the remaining Node Groups/data**

Prefer reusable groups (`Interrogative Search`, `Recursive Possession`, `Comparison`) rather than one group per sentence. Parameters and tables carry language-specific forms; the internal graphs remain compositions of generic primitives.

- [ ] **Step 4: Verify GREEN and full suite**

Run: `npm test`
Expected: all reference-language cases and legacy tests pass.

- [ ] **Step 5: Commit**

```bash
git add examples/reference-language.vertax examples/reference-language
git commit -m "feat: complete reference language grammar"
```

---

### Task 7: Complete 1.0 Resource Authoring and Node Group Transfer in Studio

**Files:**
- Modify: `packages/studio-model/src/model.ts`
- Modify: `packages/studio-model/src/project-session.ts`
- Create: `packages/studio-model/src/resource-edit.ts`
- Modify: `packages/studio-model/src/index.ts`
- Create: `packages/studio-model/tests/resource-edit.test.mjs`
- Create: `apps/studio/src/resource-editor.ts`
- Create: `apps/studio/src/node-group-transfer.ts`
- Modify: `apps/studio/src/project-tree.ts`
- Modify: `apps/studio/src/app.ts`
- Modify: `apps/studio/src/workspace-routing.ts`
- Modify: `apps/studio/public/studio.css`
- Test: `apps/studio/tests/resource-authoring.test.mjs`
- Test: `apps/studio/tests/node-group-transfer.test.mjs`

**Interfaces:**
- Extend `StudioWorkspace` with `Lexicon` and `Tables`.
- Produce immutable operations: `upsertLexeme`, `deleteLexeme`, `upsertTableRow`, `deleteTableRow`, each returning Studio edit diagnostics and marking state dirty.
- `exportNodeGroup(project, id): string` serializes one standard `NodeGroupDocument`.
- `importNodeGroup(project, text): { project?: LoadedVertaxProject; diagnostics: readonly Diagnostic[] }` uses the existing decoder, rejects duplicate stable IDs, and does not mutate on failure.

- [ ] **Step 1: Write failing model/UI tests**

Test Lexicon and Tables are selectable from the project tree, fields can be edited without raw project JSON, valency/related lexeme entries persist, table rows can be added/edited/deleted, and all edits survive browser save/reload.

Test Node Group export→import round-trip; duplicate ID returns a diagnostic and leaves the project byte-equivalent. Add accessibility smoke assertions: resource controls have labels, buttons are keyboard-focusable, and workspace switching preserves a logical heading structure.

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test packages/studio-model/tests/resource-edit.test.mjs apps/studio/tests/resource-authoring.test.mjs apps/studio/tests/node-group-transfer.test.mjs`
Expected: resource workspaces/import-export are absent.

- [ ] **Step 3: Implement resource authoring and transfer**

Use existing decoders/validators as authority. Do not create a second resource schema in Studio.

- [ ] **Step 4: Verify GREEN, Studio build, and HTTP smoke**

Run: `npm test && npm run typecheck && npm run studio:build`
Expected: all pass; `/`, CSS, and compiled Studio module return 200 from the dev server.

- [ ] **Step 5: Commit**

```bash
git add packages/studio-model apps/studio
git commit -m "feat: complete resource authoring workflows"
```

---

### Task 8: Remove Reference Source Exceptions and Harden the 1.0 Acceptance Gate

**Files:**
- Modify/remove: `examples/reference-slice/project.ts`
- Modify: `examples/reference-slice/persisted-project.ts`
- Modify: `examples/reference-slice/studio-project.ts`
- Modify: `apps/cli/src/main.ts`
- Create: `apps/cli/tests/reference-language.test.mjs`
- Create: `examples/reference-language/hardening.test.mjs`
- Modify: project/runtime/compiler tests as necessary for recursion/determinism/performance diagnostics.

**Interfaces:**
- CLI: `vertax test-project <path>` loads, validates, registers core primitives + persisted Node Groups, runs every supported persisted test, prints pass/fail summary, exits nonzero on any failed test.
- Canonical reference loading helper may live in test/example code, but it may only orchestrate generic loaders/registries; it contains no grammar logic.

- [ ] **Step 1: Write the final failing 1.0 gate**

The gate must assert:
1. `examples/reference-language.vertax` validates with zero Error/Fatal diagnostics.
2. All persisted Meaning→Surface tests pass through generic registration only.
3. Registry contains no executable type ID beginning `ref.`.
4. Source scan of `packages/runtime`, `packages/compiler`, `packages/primitives`, and `packages/project-model` finds none of the reference-language concept/morpheme IDs used as conditional branches.
5. Repeating the complete corpus at least 25 times produces identical Surface strings and identical ordered rule/node trace IDs.
6. Deliberate recursive Node Groups terminate with `NODE_GROUP_RECURSION_LIMIT`.
7. A deliberately cyclic graph terminates with `CYCLIC_GRAPH_EDGE`.
8. Schema-0 migration regression remains green.
9. A representative deeply nested sentence completes within a generous regression ceiling (5 seconds locally) to catch accidental exponential behavior, without treating this as a benchmark.
10. Existing canonical sentence remains exactly `person'vo duru esi'cook food`.

- [ ] **Step 2: Run RED**

Run: `npm run build && node --test examples/reference-language/hardening.test.mjs apps/cli/tests/reference-language.test.mjs`
Expected: source-specific reference nodes/CLI gap or hardening gaps cause failure.

- [ ] **Step 3: Remove the final reference-specific executable code and implement CLI runner**

Delete `registerReferenceSliceNodes` and the `ref.question-cook-grammar` / `ref.to-morph` path. Compatibility fixtures must load the canonical persisted project or use only generic built-in nodes. Improve diagnostic copy only where tests show ambiguity; do not broaden scope into Phase 7 packaging.

- [ ] **Step 4: Run complete release-candidate verification**

Run:
```bash
npm test
npm run typecheck
npm run studio:build
npm run demo
node dist/apps/cli/src/main.js validate-project examples/reference-language.vertax
node dist/apps/cli/src/main.js test-project examples/reference-language.vertax
git diff --check
```
Expected: zero failures/errors; demo remains `person'vo duru esi'cook food`; validation/test CLI exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages apps examples
 git commit -m "feat: pass Vertax 1.0 reference acceptance"
```

---

## Phase 6 Completion Contract

Phase 6 is complete only when all of the following are true on a clean branch tip:

- Every language behavior named in Spec §65 has at least one persisted acceptance case.
- The canonical reference language loads from `examples/reference-language.vertax/` and uses no source-code grammar implementation.
- Persisted Node Groups are executable, nestable, typed, traceable, and recursion-safe.
- Branching graphs can intentionally produce no value without false cycle errors.
- Lists, scopes, Requirements, features, lexicon relations/valency, and data tables are authorable generic primitives.
- Lexicon and Data Tables have normal Studio authoring workflows.
- Node Groups can be imported/exported independently.
- `validate-project` and `test-project` both pass the canonical project.
- Full tests/typecheck/Studio build/HTTP smoke pass.
- `person'vo duru esi'cook food` is unchanged.
- Final whole-branch review has no unresolved Critical/Important findings.

