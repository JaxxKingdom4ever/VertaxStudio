# Vertax 2 Sentence Lab, Meaning Composer, and Trace Debugger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Studio/compiler into an interactive language IDE where users can construct a confirmed MeaningGraph, compile it, inspect Final/Gloss/Structure/Trace/Errors views, examine compiler state at each trace step, use node breakpoints, and save successful examples as persisted regression tests.

**Architecture:** Add immutable debugger snapshots to the compiler without changing compilation semantics, then build a UI-independent `sentence-lab` package that owns MeaningGraph editing, lab session state, output formatting, trace navigation, breakpoint matching, and persisted-test integration. The existing native DOM/SVG Studio consumes those APIs; arbitrary natural-language parsing remains deferred, so source text is optional context while the confirmed MeaningGraph is authoritative.

**Tech Stack:** TypeScript, Node.js built-in test runner, native DOM/SVG/CSS Studio, existing Vertax compiler/runtime/project-model packages. No new external dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`

## Global Constraints

- MeaningGraph remains the authority; source text must never silently override confirmed semantic structure.
- Confirmed MeaningGraph compilation remains deterministic.
- Existing compiler output for the reference slice must remain exactly `person'vo duru esi'cook food`.
- Debugging data must be observational: enabling trace/debug frames cannot change rule selection, values, scopes, Requirements, or final output.
- Trace frames must preserve enough state to inspect compiler values, current scope, scope ancestry, and Requirement status at each transformation.
- Breakpoints in Phase 4 are trace breakpoints: compilation completes deterministically, then the debugger positions the trace cursor at the first matching node execution. Incremental node-by-node compiler suspension is deferred.
- Meaning Composer must support Form, Tree, and Graph views over the same `SemanticGraph`; no parallel semantic representation is allowed.
- Removing a semantic object must not leave dangling role targets or root references.
- Structure/Gloss views are derived from actual compiler stage outputs, never reparsed from final surface strings.
- Saved Sentence Lab examples use the existing persisted test model and `.vertax` project persistence.
- Browser-facing Studio code must not import Node filesystem modules.
- Existing Graph Studio behavior, project persistence, and 95-test Phase 3 baseline must remain green.

## Review Focus

1. **Trace/debug mode changes compiler behavior:** Task 1 must compile the same input in `fast` and `trace` modes and assert identical stage values, diagnostics, success status, and final surface.
2. **Semantic object deletion leaves dangling references:** Task 2 must delete a shared referenced object and prove roots plus every inbound role target are cleaned consistently.
3. **MeaningGraph contains a reference cycle/shared object:** Task 2 must prove Tree view terminates and marks repeated/cyclic references instead of recursing forever or duplicating identity.
4. **Breakpoint node never executes:** Task 4 must leave trace cursor unchanged and report no hit rather than manufacturing a breakpoint event.
5. **A saved lab test is persisted but not executable after reload:** Task 5/8 must save a Meaning→Surface test into a real `.vertax` project, reload it, execute it through the current compiler, and assert the expected exact surface.

---

## File Structure Locked by This Plan

```text
packages/
├── compiler/
│   ├── src/
│   │   ├── debug-snapshot.ts          # immutable runtime/value snapshots for trace inspection
│   │   ├── stage.ts                   # emits stage debug frames
│   │   └── pipeline.ts                # aggregates frames across stages
│   └── tests/
│       └── debug-trace.test.mjs
├── sentence-lab/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── model.ts                   # lab state, views, breakpoints, compile state
│   │   ├── meaning-edit.ts            # immutable SemanticGraph authoring operations
│   │   ├── meaning-tree.ts            # cycle-safe/shared-reference tree projection
│   │   ├── session.ts                 # compile orchestration and trace cursor behavior
│   │   ├── formatters.ts              # Final/Gloss/Structure/Error view models
│   │   ├── debugger.ts                # trace frames, object/scope/Requirement inspection
│   │   ├── tests.ts                   # create/run persisted Sentence Lab tests
│   │   └── index.ts
│   └── tests/
│       ├── meaning-edit.test.mjs
│       ├── session.test.mjs
│       ├── formatters.test.mjs
│       ├── debugger.test.mjs
│       └── persisted-tests.test.mjs
apps/studio/
├── src/
│   ├── sentence-lab.ts                # Sentence Lab workspace shell/output tabs
│   ├── meaning-composer.ts            # Form/Tree/Graph semantic editing UI
│   ├── trace-debugger.ts              # timeline, breakpoints, object inspector, scope stack
│   ├── lab-tests.ts                   # Save as Test / run test UI
│   ├── project-tree.ts                # routes Sentence Lab and Tests resources
│   ├── app.ts                         # integrates new workspace
│   └── main.ts
├── public/studio.css
└── tests/
    ├── sentence-lab-ui.test.mjs
    ├── meaning-composer-ui.test.mjs
    ├── trace-debugger-ui.test.mjs
    └── phase4-acceptance.test.mjs
examples/reference-slice/
└── persisted-project.ts               # persisted test fixture added through public APIs only
```

---

### Task 1: Immutable Compiler Debug Frames

**Files:**
- Create: `packages/compiler/src/debug-snapshot.ts`
- Modify: `packages/compiler/src/stage.ts`
- Modify: `packages/compiler/src/pipeline.ts`
- Modify: `packages/compiler/src/index.ts`
- Test: `packages/compiler/tests/debug-trace.test.mjs`

**Interfaces:**
- Consumes: existing `RuntimeState`, `CompilerValue`, `TraceStep`, `StageResult`, `CompileResult`.
- Produces:
  - `interface DebugScopeSnapshot { id: StableId; type: string; parentId?: StableId; childIds: readonly StableId[]; requirementIds: readonly StableId[]; status: "OPEN" | "RESOLVED" | "FAILED" }`
  - `interface DebugRequirementSnapshot { id: StableId; ownerScopeId: StableId; creatorId: StableId; acceptedTypes: readonly string[]; status: "OPEN" | "RESOLVED" | "FAILED"; resolutionId?: StableId }`
  - `interface DebugRuntimeSnapshot { currentScopeId: StableId; values: readonly CompilerValue[]; scopes: readonly DebugScopeSnapshot[]; requirements: readonly DebugRequirementSnapshot[] }`
  - `interface DebugTraceFrame { readonly trace: TraceStep; readonly before: DebugRuntimeSnapshot; readonly after: DebugRuntimeSnapshot }`
  - `function snapshotDebugState(state: RuntimeState, values: readonly CompilerValue[]): DebugRuntimeSnapshot`
  - `StageResult.debugFrames: readonly DebugTraceFrame[]`
  - `CompileResult.debugFrames: readonly DebugTraceFrame[]`

- [ ] **Step 1: Write failing debug-frame tests**

Assert that trace-mode compilation of `whoIsCookingFood`:

```ts
expect(result.debugFrames.length).toBeGreaterThan(0);
expect(result.debugFrames[0].before.currentScopeId).toBe('scope:root');
expect(result.debugFrames[0].before.values[0].id).toBe('cook-event');
expect(result.debugFrames[0].after.values.length).toBeGreaterThan(0);
```

Also compile the same input in `fast` and `trace` modes and assert both results have identical:

```text
success
surface
diagnostics
Grammar stage values
Morphology stage values
Surface stage values
```

Only trace/debug metadata may differ.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm run build && node --test packages/compiler/tests/debug-trace.test.mjs
```

Expected: FAIL because debug snapshots/frames do not exist.

- [ ] **Step 3: Implement immutable `snapshotDebugState`**

Copy the ordered runtime/value information needed by the debugger. Sort scope and Requirement snapshots by stable ID so identical compiler runs yield stable debug output.

- [ ] **Step 4: Capture before/after snapshots around every successful rule transformation**

`compileStage` must create a `DebugTraceFrame` from the same transformation that produces its existing `TraceStep`. Frame capture must not participate in fingerprints, matching, or state mutation.

- [ ] **Step 5: Aggregate stage frames in `compileMeaningGraph`**

Fast mode returns `debugFrames: []`; trace and strict modes retain frames for stages that execute.

- [ ] **Step 6: Run compiler tests and full suite**

```bash
npm run build && node --test packages/compiler/tests/debug-trace.test.mjs
npm test
npm run typecheck
```

Expected: PASS with existing reference output unchanged.

- [ ] **Step 7: Commit**

```bash
git add packages/compiler

git commit -m "feat: capture compiler debug frames"
```

---

### Task 2: Meaning Composer Data Model

**Files:**
- Create: `packages/sentence-lab/package.json`
- Create: `packages/sentence-lab/tsconfig.json`
- Create: `packages/sentence-lab/src/model.ts`
- Create: `packages/sentence-lab/src/meaning-edit.ts`
- Create: `packages/sentence-lab/src/meaning-tree.ts`
- Create: `packages/sentence-lab/src/index.ts`
- Test: `packages/sentence-lab/tests/meaning-edit.test.mjs`

**Interfaces:**
- Consumes: `SemanticGraph`, `SemanticObject`, `SemanticType`, `FeatureBundle`, `Diagnostic`.
- Produces:
  - `type MeaningComposerView = "Form" | "Tree" | "Graph"`
  - `interface MeaningTreeNode { objectId: StableId; role?: string; repeated: boolean; cyclic: boolean; children: readonly MeaningTreeNode[] }`
  - `function createEmptyMeaningGraph(): SemanticGraph`
  - `function addSemanticObject(graph: SemanticGraph, object: SemanticObject): MeaningEditResult`
  - `function updateSemanticObject(graph: SemanticGraph, objectId: StableId, patch: Partial<Pick<SemanticObject,"conceptId"|"features">>): MeaningEditResult`
  - `function setSemanticRole(graph: SemanticGraph, sourceId: StableId, role: string, targetIds: readonly StableId[]): MeaningEditResult`
  - `function setSemanticRoots(graph: SemanticGraph, rootIds: readonly StableId[]): MeaningEditResult`
  - `function removeSemanticObject(graph: SemanticGraph, objectId: StableId): MeaningEditResult`
  - `function buildMeaningTree(graph: SemanticGraph): readonly MeaningTreeNode[]`

`MeaningEditResult` contains `{ graph, diagnostics }` and never mutates its input.

- [ ] **Step 1: Write failing immutable edit tests**

Cover:

- duplicate object ID → `DUPLICATE_SEMANTIC_OBJECT`;
- unknown role target → `MISSING_SEMANTIC_REFERENCE`;
- root assignment with missing IDs rejected;
- object update changes only requested fields;
- input graph remains deeply unchanged.

- [ ] **Step 2: Add the shared-reference deletion regression test**

Create two events referencing the same entity; delete that entity; assert:

```text
entity removed from objects
entity removed from roots
all inbound role arrays no longer contain entity ID
no unrelated roles/objects changed
```

- [ ] **Step 3: Add cycle/shared-reference Tree projection tests**

Construct A→B→A plus another role referencing B. `buildMeaningTree` must terminate, preserve object IDs, and mark repeat/cycle nodes instead of infinitely expanding them.

- [ ] **Step 4: Run tests and verify RED**

```bash
npm run build && node --test packages/sentence-lab/tests/meaning-edit.test.mjs
```

Expected: FAIL because the package does not exist.

- [ ] **Step 5: Implement immutable graph editing and cycle-safe Tree projection**

Graph view will use the SemanticGraph directly; Form and Tree are alternate projections, not stored copies.

- [ ] **Step 6: Run tests/full suite/typecheck**

```bash
npm run build && node --test packages/sentence-lab/tests/meaning-edit.test.mjs
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/sentence-lab package.json tsconfig.json

git commit -m "feat: add Meaning Composer model"
```

---

### Task 3: Sentence Lab Session and Compile Orchestration

**Files:**
- Create: `packages/sentence-lab/src/session.ts`
- Modify: `packages/sentence-lab/src/model.ts`
- Modify: `packages/sentence-lab/src/index.ts`
- Test: `packages/sentence-lab/tests/session.test.mjs`

**Interfaces:**
- Consumes: `LoadedVertaxProject`, `NodeDefinition[]`, `toCompilerProject`, `NodeRegistry`, `compileMeaningGraph`.
- Produces:
  - `type SentenceLabOutputView = "Final" | "Gloss" | "Structure" | "Trace" | "Errors"`
  - `interface SentenceLabState { sourceText: string; meaningGraph: SemanticGraph; composerView: MeaningComposerView; outputView: SentenceLabOutputView; compileMode: "fast" | "trace" | "strict"; maxStepsPerStage: number; result?: CompileResult; traceCursor?: number; selectedValueId?: StableId; breakpoints: readonly StableId[]; diagnostics: readonly Diagnostic[] }`
  - `function createSentenceLabState(initialGraph?: SemanticGraph): SentenceLabState`
  - `function createRegistryFromDefinitions(definitions: readonly NodeDefinition[]): NodeRegistry`
  - `function compileSentenceLab(project: LoadedVertaxProject, definitions: readonly NodeDefinition[], state: SentenceLabState): SentenceLabState`
  - pure setters for source text, composer/output view, meaning graph, compile mode, trace cursor, selected value, breakpoints.

- [ ] **Step 1: Write failing session tests**

Assert the reference persisted project plus reference node definitions compiles `whoIsCookingFood` to exactly:

```text
person'vo duru esi'cook food
```

The state must retain the input MeaningGraph and source text unchanged.

- [ ] **Step 2: Test adapter/semantic failure handling**

A project that cannot adapt to `CompilerProject` and a malformed MeaningGraph must return diagnostics in Lab state without throwing or fabricating a compile result.

- [ ] **Step 3: Test compile-mode behavior**

`fast` gives final output with no debug frames; `trace` yields debug frames and defaults the cursor to the first frame when frames exist.

- [ ] **Step 4: Run tests and verify RED**

```bash
npm run build && node --test packages/sentence-lab/tests/session.test.mjs
```

Expected: FAIL because session orchestration is missing.

- [ ] **Step 5: Implement registry reconstruction and Lab compilation**

Source text is metadata/context only. `compileSentenceLab` compiles `state.meaningGraph`; it never reparses `sourceText`.

- [ ] **Step 6: Run tests/full suite/typecheck**

```bash
npm run build && node --test packages/sentence-lab/tests/session.test.mjs
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/sentence-lab

git commit -m "feat: add Sentence Lab compile sessions"
```

---

### Task 4: Trace Debugger Model, Object Inspector, Scope Stack, and Breakpoints

**Files:**
- Create: `packages/sentence-lab/src/debugger.ts`
- Modify: `packages/sentence-lab/src/session.ts`
- Modify: `packages/sentence-lab/src/index.ts`
- Test: `packages/sentence-lab/tests/debugger.test.mjs`

**Interfaces:**
- Consumes: `DebugTraceFrame[]`, Lab trace cursor/breakpoints.
- Produces:
  - `interface TraceRow { index: number; stage: CompilerStage; ruleId?: StableId; graphId?: StableId; nodeIds: readonly StableId[]; reason: string; breakpoint: boolean }`
  - `interface ScopeTreeNode { id: StableId; type: string; status: string; current: boolean; children: readonly ScopeTreeNode[] }`
  - `function buildTraceRows(frames: readonly DebugTraceFrame[], breakpoints: readonly StableId[]): readonly TraceRow[]`
  - `function findFirstBreakpointHit(frames: readonly DebugTraceFrame[], breakpoints: readonly StableId[]): number | undefined`
  - `function inspectTraceValue(frame: DebugTraceFrame, phase: "before" | "after", valueId: StableId): CompilerValue | undefined`
  - `function buildScopeTree(frame: DebugTraceFrame, phase: "before" | "after"): readonly ScopeTreeNode[]`
  - `function openRequirements(frame: DebugTraceFrame, phase: "before" | "after"): readonly DebugRequirementSnapshot[]`
  - `function setBreakpoint(state: SentenceLabState, nodeId: StableId, enabled: boolean): SentenceLabState`

- [ ] **Step 1: Write failing trace navigation/inspection tests**

Use a synthetic frame with nested scopes and Requirements. Assert current scope path, open Requirement filtering, and before/after value inspection by stable ID.

- [ ] **Step 2: Write breakpoint tests**

A breakpoint node contained in frame 3 returns index 3 and marks that row. A nonexistent breakpoint returns `undefined` and does not change the state cursor.

- [ ] **Step 3: Write compile-to-breakpoint cursor test**

When trace compilation completes and a breakpoint matches, `compileSentenceLab` positions `traceCursor` at the first matching frame; otherwise it uses frame 0.

- [ ] **Step 4: Run tests and verify RED**

```bash
npm run build && node --test packages/sentence-lab/tests/debugger.test.mjs
```

Expected: FAIL.

- [ ] **Step 5: Implement debugger projections and trace breakpoint semantics**

Do not stop or alter compiler execution; breakpoints select an already-produced immutable frame.

- [ ] **Step 6: Run tests/full suite/typecheck**

```bash
npm run build && node --test packages/sentence-lab/tests/debugger.test.mjs
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/sentence-lab

git commit -m "feat: add Sentence Lab trace debugger model"
```

---

### Task 5: Final, Gloss, Structure, Errors, and Persisted Test Integration

**Files:**
- Create: `packages/sentence-lab/src/formatters.ts`
- Create: `packages/sentence-lab/src/tests.ts`
- Modify: `packages/sentence-lab/src/index.ts`
- Test: `packages/sentence-lab/tests/formatters.test.mjs`
- Test: `packages/sentence-lab/tests/persisted-tests.test.mjs`

**Interfaces:**
- Consumes: `CompileResult`, `MorphSequence`, `SurfaceForm`, `LoadedVertaxProject`, `PersistedTestDocument`.
- Produces:
  - `interface StructureSection { stage: CompilerStage; values: readonly StructureValue[] }`
  - `interface GlossUnit { valueId: StableId; morphemes: readonly string[]; glosses: readonly string[] }`
  - `function buildStructureSections(result: CompileResult): readonly StructureSection[]`
  - `function buildGlossUnits(result: CompileResult): readonly GlossUnit[]`
  - `function buildErrorList(state: SentenceLabState): readonly Diagnostic[]`
  - `function createSentenceLabTest(args: { id: StableId; name: string; state: SentenceLabState }): PersistedTestDocument`
  - `function addSentenceLabTest(project: LoadedVertaxProject, test: PersistedTestDocument): LoadedVertaxProject`
  - `function runPersistedMeaningTest(project: LoadedVertaxProject, definitions: readonly NodeDefinition[], test: PersistedTestDocument): PersistedTestRunResult`

- [ ] **Step 1: Write failing Structure/Gloss formatter tests**

For the reference compile:

- Structure has Grammar, Morphology, and Surface sections built from stage values;
- Morphology gloss exposes morph segmentation without reparsing the final string;
- `esi + cook` appears as two morph entries;
- any `ZeroMorph` appears as an explicit `ZERO(<featureId>)` gloss even though it contributes no surface characters.

- [ ] **Step 2: Write failing Save-as-Test tests**

A successful Lab state creates a schema-1 Meaning→Surface persisted test with:

```text
input_stage = Meaning
expected_stage = Surface
input = confirmed SemanticGraph
expected_output = exact final surface string
```

Duplicate test IDs are rejected rather than overwritten.

- [ ] **Step 3: Write failing persisted-test execution test**

`runPersistedMeaningTest` must compile the stored MeaningGraph and return PASS only when the exact expected surface matches. Unsupported input/output stage combinations return an explicit diagnostic in Phase 4 rather than pretending to execute them.

- [ ] **Step 4: Run tests and verify RED**

```bash
npm run build && node --test packages/sentence-lab/tests/formatters.test.mjs packages/sentence-lab/tests/persisted-tests.test.mjs
```

Expected: FAIL.

- [ ] **Step 5: Implement formatters and test integration**

Gloss is intentionally compiler/debug oriented in this phase; it displays actual morph boundaries/kinds/features. Rich linguistic gloss metadata can be added in the authoring phase without changing this interface.

- [ ] **Step 6: Run tests/full suite/typecheck**

```bash
npm run build && node --test packages/sentence-lab/tests/formatters.test.mjs packages/sentence-lab/tests/persisted-tests.test.mjs
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/sentence-lab

git commit -m "feat: add Sentence Lab output views and tests"
```

---

### Task 6: Sentence Lab and Meaning Composer Studio UI

**Files:**
- Create: `apps/studio/src/sentence-lab.ts`
- Create: `apps/studio/src/meaning-composer.ts`
- Modify: `apps/studio/src/app.ts`
- Modify: `apps/studio/src/project-tree.ts`
- Modify: `apps/studio/public/index.html`
- Modify: `apps/studio/public/studio.css`
- Test: `apps/studio/tests/sentence-lab-ui.test.mjs`
- Test: `apps/studio/tests/meaning-composer-ui.test.mjs`

**Interfaces:**
- Consumes: Sentence Lab/Meaning Composer model APIs from Tasks 2–5.
- Produces browser UI for:
  - optional Source text context field;
  - Compile button and mode selector;
  - Meaning Composer `Form | Tree | Graph` tabs;
  - Final/Gloss/Structure/Trace/Errors output tabs;
  - adding/removing semantic objects;
  - editing type, concept, features, roots, roles;
  - selecting semantic objects shared across all three Composer views.

- [ ] **Step 1: Write failing UI smoke tests**

Rendered Sentence Lab must contain:

```text
Source
Meaning
Compile
Form
Tree
Graph
Final
Gloss
Structure
Trace
Errors
```

Graph Studio navigation must remain present.

- [ ] **Step 2: Write Meaning Composer DOM tests**

Using a real `SentenceLabState`, verify:

- Form view lists every semantic object once;
- Tree view marks repeated/cyclic references;
- Graph view uses one visual node per semantic object ID and role edges between IDs;
- changing an object through Form is visible in Tree/Graph because all views share the same SemanticGraph.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm run build && node --test apps/studio/tests/sentence-lab-ui.test.mjs apps/studio/tests/meaning-composer-ui.test.mjs
```

Expected: FAIL because the UI modules are missing.

- [ ] **Step 4: Implement Sentence Lab workspace rendering**

Do not add a natural-language parser. Source text remains an optional reference/context field; Compile uses the confirmed MeaningGraph.

- [ ] **Step 5: Implement Form/Tree/Graph semantic editing UI**

Use native DOM/SVG like Graph Studio. Graph-view dragging may be ephemeral/layout-only in Phase 4; semantic identity and role edges come directly from the MeaningGraph.

- [ ] **Step 6: Run UI tests, Studio build, and full suite**

```bash
npm run build && node --test apps/studio/tests/sentence-lab-ui.test.mjs apps/studio/tests/meaning-composer-ui.test.mjs
npm run studio:build
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/studio packages/sentence-lab

git commit -m "feat: add Sentence Lab and Meaning Composer UI"
```

---

### Task 7: Trace Debugger Studio UI and Graph Breakpoints

**Files:**
- Create: `apps/studio/src/trace-debugger.ts`
- Modify: `apps/studio/src/graph-canvas.ts`
- Modify: `apps/studio/src/inspector.ts`
- Modify: `apps/studio/src/sentence-lab.ts`
- Modify: `apps/studio/public/studio.css`
- Test: `apps/studio/tests/trace-debugger-ui.test.mjs`

**Interfaces:**
- Consumes: Task 4 debugger APIs and Sentence Lab state.
- Produces:
  - trace timeline with current frame;
  - previous/next/frame selection;
  - Before/After toggle;
  - value inspector;
  - scope tree/current scope indicator;
  - open Requirement list;
  - breakpoint badges;
  - Graph Studio action `Pause Trace Here` / toggle breakpoint for selected node.

- [ ] **Step 1: Write failing debugger DOM tests**

Trace view must render stage, rule, node IDs, before/after value IDs, scope tree, and Requirements for a synthetic debug frame.

- [ ] **Step 2: Write failing breakpoint integration test**

Toggle a Graph Studio node breakpoint, switch to Sentence Lab, compile the reference input in trace mode, and assert the trace cursor lands on the first frame whose `nodeIds` contains that node.

- [ ] **Step 3: Write missing-breakpoint test**

A breakpoint for a node that never executes must display as unhit and must not move the cursor away from the normal first frame.

- [ ] **Step 4: Run tests and verify RED**

```bash
npm run build && node --test apps/studio/tests/trace-debugger-ui.test.mjs
```

Expected: FAIL.

- [ ] **Step 5: Implement trace debugger rendering and breakpoint actions**

Graph Studio stores breakpoints in the active Sentence Lab session, not in executable graph documents. They are debugging state, not language semantics.

- [ ] **Step 6: Run debugger tests, Studio build, full suite/typecheck**

```bash
npm run build && node --test apps/studio/tests/trace-debugger-ui.test.mjs
npm run studio:build
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/studio packages/sentence-lab

git commit -m "feat: add Studio trace debugger"
```

---

### Task 8: Save-as-Test, Test Runner, Disk Round Trip, and Phase 4 Acceptance

**Files:**
- Create: `apps/studio/src/lab-tests.ts`
- Modify: `apps/studio/src/sentence-lab.ts`
- Modify: `apps/studio/src/project-tree.ts`
- Modify: `apps/studio/src/browser-project.ts`
- Modify: `apps/studio/server.mjs`
- Modify: `examples/reference-slice/persisted-project.ts`
- Test: `apps/studio/tests/phase4-acceptance.test.mjs`
- Test: `packages/sentence-lab/tests/persisted-tests.test.mjs`

**Interfaces:**
- Consumes: existing `/api/project` save/load bridge, project persistence, Task 5 persisted-test APIs.
- Produces:
  - `Save as Test` UI from successful Sentence Lab compile;
  - Tests workspace showing persisted test name/status;
  - `Run` and `Run All` for supported Meaning→Surface tests;
  - persisted project save/reload preserving tests;
  - Phase 4 end-to-end acceptance workflow.

- [ ] **Step 1: Write the Phase 4 acceptance test**

Using the real reference persisted project and real node definitions:

```text
open Studio Sentence Lab
load/construct whoIsCookingFood MeaningGraph
compile in trace mode
Final == person'vo duru esi'cook food
Gloss contains esi and cook as distinct morphs
Structure includes Grammar/Morphology/Surface
Trace contains real debug frames
object inspector can inspect cook-event in before frame
scope viewer includes scope:root
save result as persisted test
save .vertax project to disk
reload project
run persisted test
PASS with exact expected surface
```

- [ ] **Step 2: Add the persistence regression assertion**

After reload, the test ID/name/input/expected output must be identical and the manifest canonicalization must include `tests/<id>.json`.

- [ ] **Step 3: Add browser/server smoke coverage**

Build and launch Studio server; assert HTTP 200 for `/`, CSS, compiled module, and project API. Browser-facing modules must remain free of `node:` imports.

- [ ] **Step 4: Run acceptance tests and verify RED**

```bash
npm run build && node --test apps/studio/tests/phase4-acceptance.test.mjs packages/sentence-lab/tests/persisted-tests.test.mjs
```

Expected: FAIL until UI/test persistence integration is complete.

- [ ] **Step 5: Implement Save-as-Test and Tests workspace**

Test IDs are explicit/stable; duplicate IDs show a diagnostic instead of overwriting an existing test.

- [ ] **Step 6: Run the complete Phase 4 verification**

```bash
npm test
npm run typecheck
npm run studio:build
npm run demo
```

Expected:

```text
all tests pass
typecheck exit 0
Studio build exit 0
demo output: person'vo duru esi'cook food
```

Then run the Studio HTTP smoke with `studio:build` immediately before starting the server and verify `/`, `studio.css`, compiled entry module, and `/api/project` all respond correctly.

- [ ] **Step 7: Commit**

```bash
git add apps/studio packages/sentence-lab examples/reference-slice

git commit -m "feat: complete Sentence Lab and trace debugger"
```

---

## End State of This Plan

After Phase 4, Vertax Studio will support the complete language-IDE loop:

```text
optional source/context text
        ↓
confirmed MeaningGraph
(Form / Tree / Graph)
        ↓
Compile
        ↓
Final | Gloss | Structure | Trace | Errors
                         ↓
             immutable debug frames
              ├─ compiler values
              ├─ scope stack
              ├─ Requirements
              └─ node breakpoint hits
        ↓
Save as Test
        ↓
real persisted .vertax regression test
        ↓
Run / Run All after project reload
```

The reference acceptance case must still compile to exactly:

```text
person'vo duru esi'cook food
```

This phase deliberately does **not** add arbitrary English parsing. The user may keep source text alongside the example, but Vertax compiles only the confirmed MeaningGraph. That preserves the architectural rule that AI/parser interpretation may propose meaning later, while the deterministic language compiler remains independent from it.
