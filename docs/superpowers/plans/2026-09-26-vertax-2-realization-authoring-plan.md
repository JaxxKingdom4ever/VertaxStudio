# Vertax 2 Morphology, Phonology, and Surface Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Vertax’s realization pipeline fully authorable: abstract morphology, structured phonology, orthography/surface rules, source maps, and Studio authoring metadata all work as first-class typed graph stages.

**Architecture:** Extend the existing typed compiler rather than introducing a second realization engine. `MorphSequence` remains the output of Morphology; a new `PhonologicalForm` becomes the optional-but-real Phonology value; Surface consumes structured phonology (or legacy morphology when no Phonology stage exists) and emits source-mapped `SurfaceForm`. All authoring operations are ordinary registered nodes with deterministic parameters, and Studio reads authoring metadata from those node definitions.

**Tech Stack:** TypeScript, npm workspaces, Node built-in test runner, native DOM/SVG Studio, existing Vertax runtime/project model. No new external dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`

## Global Constraints

- Vertax manipulates typed linguistic structures until the Surface stage.
- Grammar emits abstract morphs before surface forms; orthographic punctuation/boundaries do not belong in morphology.
- Zero morphology is first-class and remains inspectable even when it contributes zero surface characters.
- Phonology operates on structured sequences preserving phonemes, morpheme boundaries, syllable boundaries, stress, and word boundaries.
- Surface source maps must preserve semantic/grammatical/morphological/phonological/node provenance through final character spans.
- Tables store facts; nodes store logic. Spelling inventories and reusable rewrite mappings belong in project data tables, not hard-coded language branches.
- Deterministic compilation and existing rule precedence remain unchanged.
- Projects created before this phase that omit a Phonology stage must continue to compile through the legacy Morphology → Surface path.
- No language-specific branches may be added to compiler/runtime core.
- The existing reference sentence must remain exactly `person'vo duru esi'cook food`.

## Review Focus

1. **Zero morphs:** a zero morph must remain visible in structure/gloss/provenance while contributing no characters to `SurfaceForm`.
2. **Boundary leakage:** phonological environment rules must not cross morpheme, syllable, or word boundaries unless their parameters explicitly allow it.
3. **Source-map drift:** capitalization, punctuation, joining, and orthographic rewrites must leave every `SurfaceSourceMapEntry` within the final string and attached to the intended span.
4. **Allomorph ambiguity:** equally applicable allomorphs must produce `AMBIGUOUS_ALLOMORPH` rather than silently choosing by array order.
5. **Legacy projects:** a valid project with Grammar/Morphology/Surface but no Phonology stage must continue to load and compile exactly as before.

---

## File Structure

### Core realization model
- Modify: `packages/core-types/src/morphology.ts` — richer morph metadata and realization state.
- Create: `packages/core-types/src/phonology.ts` — `PhonologicalToken`, boundaries, stress, `PhonologicalForm`.
- Modify: `packages/core-types/src/grammar.ts` — structured `SurfaceForm`, segments, source-map entries.
- Modify: `packages/core-types/src/index.ts` — export and classify `PhonologicalForm`.

### Compiler/runtime
- Modify: `packages/runtime/src/node-registry.ts` — node/graph identity in evaluation context plus optional authoring metadata.
- Modify: `packages/runtime/src/execute-graph.ts` — populate node/graph context for provenance.
- Modify: `packages/compiler/src/pipeline.ts` — optional real Phonology stage between Morphology and Surface.
- Modify: `packages/project-model/src/compiler-adapter.ts` — adapt persisted Phonology graphs without requiring them for legacy projects.

### Realization primitives
- Modify: `packages/primitives/src/morphology-nodes.ts` — complete morphology authoring library.
- Create: `packages/primitives/src/phonology-environment.ts` — deterministic environment matching/boundary traversal.
- Create: `packages/primitives/src/phonology-nodes.ts` — phonology bridge and sound-rule nodes.
- Modify: `packages/primitives/src/surface-nodes.ts` — spelling, boundary realization, rewriting, capitalization, punctuation, source-map-safe joins.
- Modify: `packages/primitives/src/index.ts` — register/export the full realization library.

### Studio/Sentence Lab
- Modify: `packages/studio-model/src/catalog.ts` — use human-facing authoring metadata.
- Modify: `apps/studio/src/node-shelf.ts` — stage/category labels and search terms.
- Modify: `apps/studio/src/inspector.ts` — typed parameter controls with JSON fallback.
- Modify: `packages/sentence-lab/src/formatters.ts` — richer gloss/structure/source-map projections.
- Modify: `apps/studio/src/sentence-lab.ts` — render phonology and provenance-aware final spans.

### Reference acceptance
- Modify: `examples/reference-slice/project.ts` — add explicit Phonology stage and orthographic boundary realization.
- Modify: `examples/reference-slice/persisted-project.ts` — persist/load Phonology graph/layout.
- Update tests across `packages/*/tests` and `apps/studio/tests`.

---

### Task 1: Typed Realization Objects

**Files:**
- Modify: `packages/core-types/src/morphology.ts`
- Create: `packages/core-types/src/phonology.ts`
- Modify: `packages/core-types/src/grammar.ts`
- Modify: `packages/core-types/src/index.ts`
- Test: `packages/core-types/tests/realization-types.test.mjs`

**Interfaces:**
- Produces:
  - `MorphRealizationState = 'Abstract' | 'Selected' | 'Realized' | 'Zero'`
  - every `Morph` has `meaningId?`, `form`, `position`, `features`, `realizationState`, `sourceIds`
  - `PhonologicalToken = PhonemeToken | BoundaryToken | StressToken`
  - `PhonologicalForm { id, tokens }`
  - `SurfaceSegment { kind, text, sourceIds, nodeIds }`
  - `SurfaceSourceMapEntry { start, end, sourceIds, nodeIds }`
  - `SurfaceForm { id, text, segments, sourceMap }`
- `CompilerValue` and `compilerValueType()` recognize `PhonologicalForm` as `PhonologicalForm`.

- [ ] **Step 1: Write failing type/behavior tests** proving zero morph metadata survives, `PhonologicalForm` has explicit boundary/stress tokens, and a structured `SurfaceForm` is classified separately from phonology.
- [ ] **Step 2: Run the focused test and verify RED** because the new types/classification do not exist.
- [ ] **Step 3: Implement the minimal core types** while preserving the current public helper names used by Phase 1–4 code.
- [ ] **Step 4: Run focused tests and the full suite**; update compatibility call sites only where the richer required fields make them fail.
- [ ] **Step 5: Commit** with `feat: add typed realization objects`.

---

### Task 2: Complete Morphology Authoring Primitives

**Files:**
- Modify: `packages/primitives/src/morphology-nodes.ts`
- Test: `packages/primitives/tests/morphology-authoring.test.mjs`

**Interfaces:**
- Produces registered node types:
  - `morph.root`
  - `morph.affix`
  - `morph.prefix`
  - `morph.suffix`
  - `morph.circumfix`
  - `morph.zero`
  - `morph.select-allomorph`
  - `morph.order`
  - `morph.fuse`
  - `morph.reduplicate`
  - `morph.mutate`
  - `morph.agreement`
- `morph.select-allomorph` consumes candidate records `{ form, when?, priority?, fallback? }`; specificity → numeric priority → non-fallback, with unresolved ties diagnosed as `AMBIGUOUS_ALLOMORPH`.
- Circumfix realization emits linked prefix/suffix morphs carrying the same meaning/source identity instead of embedding orthographic punctuation.

- [ ] **Step 1: Write failing table-driven tests** for all authoring operations, including zero morphology and ambiguous allomorphs.
- [ ] **Step 2: Verify RED** on missing node types/behaviors.
- [ ] **Step 3: Implement morphology transforms** as immutable `MorphSequence → MorphSequence` operations; do not mutate project lexicon/table data.
- [ ] **Step 4: Verify GREEN and run the full suite**, explicitly checking that zero morph realization still contributes an empty string in legacy surface behavior.
- [ ] **Step 5: Commit** with `feat: expand morphology authoring primitives`.

---

### Task 3: Real Phonology Stage and Morph-to-Phonology Bridge

**Files:**
- Modify: `packages/compiler/src/pipeline.ts`
- Modify: `packages/project-model/src/compiler-adapter.ts`
- Create: `packages/primitives/src/phonology-nodes.ts`
- Modify: `packages/primitives/src/index.ts`
- Test: `packages/compiler/tests/phonology-pipeline.test.mjs`
- Test: `packages/project-model/tests/phonology-adapter.test.mjs`

**Interfaces:**
- `CompilerProject` gains `readonly phonology?: StageProject`.
- Compilation order becomes Grammar → Morphology → Phonology (when present) → Surface.
- `toCompilerProject()` adapts persisted Phonology documents when present but does **not** make them mandatory yet.
- Produces `phon.from-morphs` and `phon.output` nodes.
- `phon.from-morphs` converts realized morph forms to phoneme tokens, inserts explicit `Morpheme` boundaries between non-zero morphs, and carries zero-morph provenance without inventing a phoneme.

- [ ] **Step 1: Write failing pipeline tests** for explicit Phonology execution and for a legacy no-Phonology project producing the same output as before.
- [ ] **Step 2: Verify RED** because `CompilerProject` cannot currently execute a Phonology stage.
- [ ] **Step 3: Implement optional Phonology execution and bridge nodes**.
- [ ] **Step 4: Verify GREEN**, including Review Focus #5: old projects compile unchanged.
- [ ] **Step 5: Commit** with `feat: add structured phonology stage`.

---

### Task 4: Phonological Environment and Sound-Rule Nodes

**Files:**
- Create: `packages/primitives/src/phonology-environment.ts`
- Modify: `packages/primitives/src/phonology-nodes.ts`
- Test: `packages/primitives/tests/phonology.test.mjs`

**Interfaces:**
- `PhonologicalEnvironment` supports target, left/right context, and independent `crossMorpheme`, `crossSyllable`, `crossWord` flags.
- Produces registered node types:
  - `phon.environment-match`
  - `phon.replace`
  - `phon.assimilate`
  - `phon.delete`
  - `phon.insert`
  - `phon.metathesize`
  - `phon.stress`
  - `phon.syllabify`
  - `phon.harmony`
  - `phon.lenition`
  - `phon.fortition`
- Lenition/fortition/harmony are mapping-driven; Vertax does not hard-code a universal phonological theory.

- [ ] **Step 1: Write failing tests** for replacement, deletion/insertion, metathesis, feature assimilation, stress/syllable tokens, mapping-based harmony/lenition/fortition, and boundary blocking.
- [ ] **Step 2: Verify RED** because no environment engine exists.
- [ ] **Step 3: Implement boundary-aware matching and immutable token transforms**.
- [ ] **Step 4: Verify GREEN**, explicitly proving Review Focus #2: the same rule fails to see a neighbor across a morpheme/word boundary until the corresponding crossing flag is enabled.
- [ ] **Step 5: Commit** with `feat: add phonology rule primitives`.

---

### Task 5: Orthography, Surface Composition, and Provenance Source Maps

**Files:**
- Modify: `packages/runtime/src/node-registry.ts`
- Modify: `packages/runtime/src/execute-graph.ts`
- Modify: `packages/primitives/src/surface-nodes.ts`
- Test: `packages/runtime/tests/node-context.test.mjs`
- Test: `packages/primitives/tests/surface-authoring.test.mjs`

**Interfaces:**
- `NodeContext` includes current `nodeId` and `graphId` so realization provenance can identify the authoring node that created text.
- Produces/extends Surface node types:
  - `surface.spell` — `PhonologicalForm → SurfaceForm`, with phoneme→grapheme facts read from a `DataTable`; parameters control realization of `Morpheme`, `Syllable`, and `Word` boundaries.
  - `surface.join`
  - `surface.space`
  - `surface.capitalize`
  - `surface.punctuate`
  - `surface.rewrite`
  - `surface.output`
- Every transform rebuilds valid `SurfaceSourceMapEntry` offsets after text changes.
- Legacy `surface.join` continues to accept `MorphSequence` for no-Phonology projects.

- [ ] **Step 1: Write failing context/source-map tests**, including spelling-table lookup, apostrophe realization of morpheme boundaries, capitalization, punctuation, rewrite, and joins.
- [ ] **Step 2: Verify RED** on missing node identity/context and structured source maps.
- [ ] **Step 3: Implement node/graph context and source-map-safe Surface transforms**.
- [ ] **Step 4: Verify GREEN**, including Review Focus #1 and #3: zero morphs add no characters, and all source-map spans remain valid after every rewrite/composition operation.
- [ ] **Step 5: Commit** with `feat: add source-mapped surface authoring`.

---

### Task 6: Human-Facing Realization Nodes in Studio

**Files:**
- Modify: `packages/runtime/src/node-registry.ts`
- Modify: `packages/primitives/src/morphology-nodes.ts`
- Modify: `packages/primitives/src/phonology-nodes.ts`
- Modify: `packages/primitives/src/surface-nodes.ts`
- Modify: `packages/studio-model/src/catalog.ts`
- Modify: `apps/studio/src/node-shelf.ts`
- Modify: `apps/studio/src/inspector.ts`
- Test: `packages/studio-model/tests/realization-catalog.test.mjs`
- Test: `apps/studio/tests/realization-authoring.test.mjs`

**Interfaces:**
- `NodeDefinition` gains optional authoring metadata:
  - `label`
  - `category` (`Morphology` | `Phonology` | `Surface` | existing categories)
  - `keywords`
  - `description`
  - typed parameter descriptors (`text`, `number`, `boolean`, `select`, `table`, `json`)
- Node Shelf displays labels such as `Select Allomorph`, `Assimilate`, and `Punctuate`, while still storing the stable `typeId` in graphs.
- Inspector renders typed controls when metadata exists and preserves the JSON editor as an advanced fallback.

- [ ] **Step 1: Write failing catalog/Inspector-model tests** proving human labels, categories, keywords, and parameter descriptors are visible for representative Morphology/Phonology/Surface nodes.
- [ ] **Step 2: Verify RED** because current catalog exposes raw `typeId`s and one JSON textarea.
- [ ] **Step 3: Add authoring metadata and typed control rendering** without changing node execution semantics.
- [ ] **Step 4: Verify GREEN and run Studio build/smoke tests**.
- [ ] **Step 5: Commit** with `feat: add realization authoring controls`.

---

### Task 7: Sentence Lab Realization Inspection

**Files:**
- Modify: `packages/sentence-lab/src/formatters.ts`
- Modify: `apps/studio/src/sentence-lab.ts`
- Test: `packages/sentence-lab/tests/realization-formatters.test.mjs`
- Test: `apps/studio/tests/phase5-sentence-lab.test.mjs`

**Interfaces:**
- `buildGlossUnits()` exposes selected/allomorphic form, morph meaning/features, and renders zero morphs as `∅` instead of dropping them.
- `buildStructureSections()` includes `Phonology` whenever the compiler executed it.
- `buildSurfaceTraceSpans(result)` returns final text spans with source/node provenance from `SurfaceForm.sourceMap`.
- Final view renders source-mapped spans with inspectable provenance; plain text remains identical.

- [ ] **Step 1: Write failing formatter tests** for zero morph glossing, Phonology structure output, and final provenance spans.
- [ ] **Step 2: Verify RED** because current formatters only understand Grammar/Morphology/Surface and text-level output.
- [ ] **Step 3: Implement richer formatters and UI projection** without introducing a second realization model.
- [ ] **Step 4: Verify GREEN**, including zero morphology visible in Gloss but absent from Final.
- [ ] **Step 5: Commit** with `feat: inspect realization stages in Sentence Lab`.

---

### Task 8: Persisted Phase 5 Acceptance Slice

**Files:**
- Modify: `examples/reference-slice/project.ts`
- Modify: `examples/reference-slice/persisted-project.ts`
- Test: `examples/reference-slice/phase5-realization.test.mjs`
- Modify: `apps/studio/tests/phase4-acceptance.test.mjs`
- Create: `apps/studio/tests/phase5-acceptance.test.mjs`

**Interfaces:**
- Reference project now persists an explicit Phonology graph using `phon.from-morphs` / `phon.output`.
- Reference Surface graph spells structured phonology and realizes `Morpheme` boundaries as `'` rather than receiving apostrophe-joined morphology strings.
- Save → load → adapt → compile remains deterministic and produces exactly `person'vo duru esi'cook food`.

- [ ] **Step 1: Write the failing end-to-end acceptance test** asserting:
  - stage sequence includes Grammar, Morphology, Phonology, Surface;
  - exact final output remains `person'vo duru esi'cook food`;
  - `esi + cook` is represented as separate morphs and separated by a Morpheme boundary in Phonology;
  - the apostrophe appears only in Surface realization;
  - final source-map spans point back to realization inputs/nodes;
  - Studio catalog exposes representative Morphology/Phonology/Surface authoring nodes;
  - save/load preserves all realization graphs and recompiles identically.
- [ ] **Step 2: Verify RED** against the current three-stage reference project.
- [ ] **Step 3: Convert the reference project to the explicit four-stage realization path** and update persisted layouts/manifests.
- [ ] **Step 4: Run full verification:** `npm test`, `npm run typecheck`, `npm run studio:build`, `npm run demo`, `git diff --check`, and the Studio HTTP asset/API smoke.
- [ ] **Step 5: Commit** with `feat: complete Phase 5 realization authoring`.

---

## Self-Review

### Spec coverage

- Spec §§30–31 (abstract morphology/Morph objects): Tasks 1–2.
- Spec §32 (structured phonology): Tasks 1, 3–4.
- Spec §33 (SurfaceForm/source maps): Tasks 1 and 5.
- Spec node families §§24.12–24.14: Tasks 2, 4, 5.
- Studio authoring/node shelf/inspector: Task 6.
- Sentence Lab Gloss/Structure/Trace integration: Task 7.
- Persistence and deterministic pipeline: Tasks 3 and 8.
- Backward compatibility for projects without Phonology: Task 3.

### Type consistency

- `PhonologicalForm` is created in Task 1, consumed by Tasks 3–5 and inspected by Task 7.
- Node authoring metadata is added once on `NodeDefinition` in Task 6 and consumed by both catalog and Inspector.
- Surface provenance uses the `nodeId`/`graphId` added to `NodeContext` in Task 5; no UI-only provenance type is introduced.
- The persisted schema already allows `Phonology` in `manifest.graphs`, so Phase 5 does not require a schema-version bump.

### Deliberate scope boundaries

- Phase 5 does **not** remove the two reference-language-specific nodes; that belongs to Phase 6’s “encode the full conlang without source-code special cases” acceptance goal.
- Phonological operations are deterministic structural transforms, not acoustic simulation or IPA validation.
- `phon.syllabify` and harmony/lenition/fortition are author-configured hooks/mappings, not claims of universal linguistic analysis.
- Legacy Morphology → Surface projects remain supported during the transition; Phase 6 may decide whether 1.0 templates always include an explicit Phonology identity stage.
