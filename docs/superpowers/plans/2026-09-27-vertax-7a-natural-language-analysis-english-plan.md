# Vertax 7A Natural-Language Analysis + English Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic persisted reverse-analysis pipeline and ship a substantial English `.vertax` language pack that can analyze real English into MeaningGraph candidates and generate English from the same shared semantics.

**Architecture:** Extend Vertax's typed value/stage system with sentence-level analysis values and four reverse stages, while leaving the existing generation compiler intact. Analysis graphs are persisted exactly like generation graphs and may branch into multiple deterministic hypotheses; the final result is a set of `SemanticGraphValue` candidates. English is an ordinary Vertax project using generic primitives, stable shared semantic IDs, lexicon data, tables, and Node Groups—never source-code language branches.

**Tech Stack:** TypeScript, existing Vertax runtime/compiler/project-model/Studio, npm workspaces, Node built-in test runner, persisted `.vertax` JSON projects.

**Spec:** `docs/superpowers/specs/2026-09-27-natural-language-packs-translation.md`

## Global Constraints

- No core package may branch on `English`, `en`, `en-US`, or any concrete language ID.
- Translation passes through MeaningGraph; no language-pair rewrite rules.
- Ambiguity survives as multiple deterministic candidates until explicitly chosen.
- Existing generation-only `.vertax` projects migrate and compile unchanged.
- Shared concepts use stable `sem:*` IDs; language-specific lexemes remain pack-local.
- English Phase 7A is substantial but does not claim perfect unrestricted parsing.
- The English pack contains at least 500 usable lexemes and a broad persisted acceptance corpus.
- Unknown/unsupported input must produce explicit diagnostics or preserved unknown entities, never silent semantic substitution.
- Language packs remain ordinary inspectable Vertax projects.

## Review Focus

1. Two analysis candidates with identical surface text but different structure must remain distinct and deterministically ordered.
2. A generation-only schema-1 project must migrate and run without acquiring fake analysis capability.
3. Shared `sem:*` concept IDs with incompatible definitions across source/target packs must block translation with a diagnostic.
4. Unknown English lowercase content words must not be guessed as an unrelated known lexeme; unsupported input must remain explicit.
5. Core/runtime/compiler/project-model source must contain no language-name/locale branch used to implement English behavior.

---

### Task 1: Shared Semantics + Schema 2 Language-Pack Contract

**Files:**
- Create: `packages/core-types/src/analysis.ts`
- Create: `packages/project-model/src/language-pack.ts`
- Modify: `packages/core-types/src/index.ts`
- Modify: `packages/project-model/src/manifest.ts`
- Modify: `packages/project-model/src/migrations.ts`
- Modify: `packages/project-model/src/model.ts`
- Modify: `packages/project-model/src/validation.ts`
- Modify: `examples/reference-language.vertax/**`
- Test: `packages/project-model/tests/language-pack.test.mjs`
- Test: `packages/project-model/tests/migrations.test.mjs`

**Interfaces:**
- Produces:
```ts
interface LanguagePackMetadata {
  readonly tag: string;              // BCP-47 when applicable, e.g. "en"
  readonly display_name: string;
  readonly autonym: string;
  readonly direction: "ltr" | "rtl";
  readonly capabilities: readonly ("generate" | "analyze")[];
}
interface ProjectManifestV2 {
  readonly schema_version: 2;
  // existing v1 fields remain unchanged
  readonly language?: LanguagePackMetadata;
}
interface SourceText { readonly id: StableId; readonly text: string; readonly provenance?: readonly ProvenanceRef[]; }
interface OrthographicToken { readonly id: StableId; readonly text: string; readonly normalized: string; readonly start: number; readonly end: number; }
interface OrthographicTokenSequence { readonly id: StableId; readonly tokens: readonly OrthographicToken[]; }
interface MorphAnalysis { readonly id: StableId; readonly tokens: readonly Readonly<Record<string, unknown>>[]; readonly features: FeatureBundle; }
interface SyntacticAnalysis { readonly id: StableId; readonly rootId: StableId; readonly nodes: Readonly<Record<StableId, Readonly<Record<string, unknown>>>>; }
interface SemanticGraphValue { readonly id: StableId; readonly graph: SemanticGraph; readonly provenance?: readonly ProvenanceRef[]; }
```
- `CompilerValue` is widened to include these sentence-level analysis values, and `compilerValueType(...)` returns stable type names for them.
- `validateSharedSemantics(source, target)` treats shared `sem:*` IDs as compatible when their declared `semanticType` matches; labels/descriptions are presentation metadata and need not match.

- [ ] **Step 1: Write failing tests** proving schema 1→2 migration preserves generation projects, schema 2 can declare language metadata/capabilities, and incompatible duplicate `sem:*` concept definitions are rejected by cross-pack validation.
- [ ] **Step 2: Run the focused tests** and verify they fail because schema 2/language-pack contracts do not exist.
- [ ] **Step 3: Implement the schema/type changes**. Add analysis value types `SourceText`, `OrthographicTokenSequence`, `MorphAnalysis`, `SyntacticAnalysis`, and `SemanticGraphValue`; extend the stage union with `OrthographyAnalysis`, `MorphologyAnalysis`, `GrammarAnalysis`, and `MeaningAnalysis`. Add schema-2 metadata sufficient to identify an ordinary project as a language pack and declare `generate`/`analyze` capabilities. Migrate schema 1→2 without adding analysis graphs.
- [ ] **Step 4: Migrate the reference-language fixture** to shared `sem:*` IDs for concepts used by cross-language tests while preserving its 30 persisted outputs.
- [ ] **Step 5: Run focused tests, then full `npm test` and `npm run typecheck`**; all existing generation behavior must remain green.
- [ ] **Step 6: Commit** with `feat: add natural-language pack contract`.

### Task 2: Generic Reverse Analysis Pipeline + Candidate Semantics

**Files:**
- Create: `packages/compiler/src/analyzer.ts`
- Create: `packages/compiler/tests/analyzer.test.mjs`
- Modify: `packages/compiler/src/index.ts`
- Modify: `packages/compiler/src/stage.ts`
- Modify: `packages/runtime/src/matchers.ts`
- Modify: `packages/runtime/src/fingerprint.ts`
- Modify: `packages/project-model/src/compiler-adapter.ts`
- Test: `packages/project-model/tests/analysis-adapter.test.mjs`

**Interfaces:**
- Consumes: analysis types/stages from Task 1.
- Produces:
```ts
interface AnalyzerProject {
  readonly orthography: StageProject;
  readonly morphology: StageProject;
  readonly grammar: StageProject;
  readonly meaning: StageProject;
  readonly resources: ProjectResources;
}
interface AnalysisCandidate {
  readonly id: StableId;
  readonly meaning: SemanticGraph;
  readonly provenance: readonly ProvenanceRef[];
}
interface AnalyzeOptions { readonly mode: "fast" | "trace" | "strict"; readonly maxStepsPerStage: number; }
interface AnalysisResult {
  readonly success: boolean;
  readonly candidates: readonly AnalysisCandidate[];
  readonly diagnostics: readonly Diagnostic[];
  readonly trace: readonly TraceStep[];
  readonly debugFrames: readonly DebugTraceFrame[];
  readonly stageResults: Readonly<Partial<Record<CompilerStage, StageResult>>>;
}
function analyzeSurface(project: AnalyzerProject, registry: NodeRegistry, text: string, options: AnalyzeOptions): AnalysisResult;
function toAnalyzerProject(project: LoadedVertaxProject): AnalyzerAdapterResult;
```
- Candidate IDs are deterministic semantic fingerprints. `success` means analysis completed without Error/Fatal diagnostics; it does **not** imply there is exactly one candidate.

- [ ] **Step 1: Write failing tests** for one-candidate analysis, one input branching into two distinct final `SemanticGraphValue` candidates, deterministic candidate order/fingerprints, trace parity, and analysis-capability validation.
- [ ] **Step 2: Run focused tests** and verify failure on missing analyzer APIs.
- [ ] **Step 3: Implement `analyzeSurface(project, registry, text, options)`** using four persisted `StageProject`s in analysis order. Each stage transforms whole-sentence hypothesis values and may replace one hypothesis with MANY alternatives. Final candidates are deduplicated only by complete semantic fingerprint, not surface text.
- [ ] **Step 4: Extend project adaptation** so generation and analysis pipelines are built independently; a generation-only project remains valid and reports no analyzer.
- [ ] **Step 5: Run focused tests and full suite/typecheck**.
- [ ] **Step 6: Commit** with `feat: add reverse language analysis pipeline`.

### Task 3: Generic Analysis Primitives

**Files:**
- Create: `packages/primitives/src/analysis-nodes.ts`
- Create: `packages/primitives/tests/analysis-nodes.test.mjs`
- Modify: `packages/primitives/src/index.ts`
- Modify: `packages/primitives/src/lexicon.ts`
- Modify: `packages/primitives/src/project-resources.ts`

**Interfaces:**
- Consumes: analysis values from Task 1 and branching pipeline from Task 2.
- Produces generic persisted nodes for tokenization, token normalization, lexeme-form lookup, morphology decomposition, feature propagation, structural pattern matching, hypothesis branching, role assignment, semantic object construction, graph assembly, unknown-token preservation, and ambiguity-safe candidate output.

- [ ] **Step 1: Write failing tests** for punctuation/token spans, case normalization without losing source text, lexeme lookup returning multiple homographs, regular affix decomposition, irregular-form lookup, structural pattern matching, unknown-token preservation, and two competing attachments producing two semantic candidates.
- [ ] **Step 2: Run focused tests** and verify the analysis node types are absent.
- [ ] **Step 3: Implement the minimal generic primitives**. No node may contain English words, English tag names, or English-specific morphology; language facts come through lexicons/tables/node parameters.
- [ ] **Step 4: Register the nodes in `registerCorePrimitives`** and expose human-readable Studio metadata/parameter descriptors.
- [ ] **Step 5: Run focused tests and full suite/typecheck**.
- [ ] **Step 6: Commit** with `feat: add generic analysis primitives`.

### Task 4: English Pack — Shared Semantics, Lexicon, Generation Grammar

**Files:**
- Create: `language-packs/english.vertax/project.json`
- Create: `language-packs/english.vertax/settings.json`
- Create: `language-packs/english.vertax/concepts/concepts.json`
- Create: `language-packs/english.vertax/features/features.json`
- Create: `language-packs/english.vertax/lexicon/lexicon.json`
- Create: `language-packs/english.vertax/tables/*.json`
- Create: `language-packs/english.vertax/node-groups/*.json`
- Create: `language-packs/english.vertax/graphs/{Grammar,Morphology,Phonology,Surface}/*.json`
- Create: `language-packs/index.json`
- Create: `language-packs/english/english-generation.test.mjs`

**Interfaces:**
- Consumes: schema-2 pack contract and generic generation runtime.
- Produces: an ordinary English pack with ≥500 lexemes and generation coverage used by Tasks 5–8.

- [ ] **Step 1: Write the English generation acceptance tests first** from shared MeaningGraphs. Cover declaratives, copular clauses, agreement, present/past/future, progressive/perfect, common irregular verbs, negation/do-support, yes/no and wh questions, determiners, plurals, possessives, pronouns/coreference, modifiers, PPs, coordination, comparisons, ditransitives, complement clauses, relatives, passives, capitalization, and punctuation.
- [ ] **Step 2: Run the focused acceptance test** and verify the pack is absent.
- [ ] **Step 3: Author the persisted English resources**. Build ≥500 lexemes including function words and common content vocabulary; represent irregulars as data/rules, not compiler branches.
- [ ] **Step 4: Author English generation graphs/Node Groups** until the acceptance corpus is green. The compiler/runtime remain untouched except for genuinely generic bugs proven with generic tests.
- [ ] **Step 5: Add the pack to `language-packs/index.json`** as a discoverable bundled language with `generate` capability.
- [ ] **Step 6: Run English generation tests, full suite, typecheck, and `validate-project language-packs/english.vertax`**.
- [ ] **Step 7: Commit** with `feat: add English generation language pack`.

### Task 5: English Pack — Orthographic/Morphological/Syntactic/Semantic Analysis

**Files:**
- Create: `language-packs/english.vertax/graphs/{OrthographyAnalysis,MorphologyAnalysis,GrammarAnalysis,MeaningAnalysis}/*.json`
- Create: additional `language-packs/english.vertax/node-groups/*.json`
- Create: `language-packs/english/english-analysis.test.mjs`
- Create: `language-packs/english/ambiguity.test.mjs`
- Modify: `language-packs/english.vertax/project.json`

**Interfaces:**
- Consumes: English lexicon/generation pack and generic analysis primitives.
- Produces: English `analyze` capability returning MeaningGraph candidates compatible with generation and translation.

- [ ] **Step 1: Write persisted/focused analysis tests** for the same grammatical families as Task 4 plus unknown tokens and the telescope attachment ambiguity. Tests compare normalized shared-semantics graphs, not only final strings.
- [ ] **Step 2: Run focused tests** and verify no analyzer is available for English yet.
- [ ] **Step 3: Author the four English analysis stages** entirely in persisted graphs/tables/Node Groups. Productive inflection and irregular forms must map back to lexeme/concept/features; syntax builds structural hypotheses; MeaningAnalysis emits shared semantic graphs.
- [ ] **Step 4: Preserve ambiguity** so `I saw the man with the telescope.` returns at least two distinct candidates with stable provenance rather than an arbitrary winner.
- [ ] **Step 5: Add explicit behavior for unsupported input**: proper-name preservation where defined, lowercase unknowns as explicit `Unknown`/diagnostic, and zero candidates for unsupported structures rather than guessed meaning.
- [ ] **Step 6: Run focused tests, full suite/typecheck, and project validation**.
- [ ] **Step 7: Commit** with `feat: add English analysis language pack`.

### Task 6: Translation API Through MeaningGraph

**Files:**
- Create: `packages/translation/package.json`
- Create: `packages/translation/tsconfig.json`
- Create: `packages/translation/src/index.ts`
- Create: `packages/translation/src/translate.ts`
- Create: `packages/translation/tests/translate.test.mjs`
- Modify: root `tsconfig.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: source analyzer, target generator, shared semantic compatibility checks.
- Produces:
```ts
interface TranslationCandidate {
  readonly id: StableId;
  readonly meaning: SemanticGraph;
  readonly targetSurface?: string;
  readonly diagnostics: readonly Diagnostic[];
}
interface TranslationResult {
  readonly success: boolean;
  readonly needsSelection: boolean;
  readonly candidates: readonly TranslationCandidate[];
  readonly selectedCandidateId?: StableId;
  readonly surface?: string;
  readonly diagnostics: readonly Diagnostic[];
}
function translateSurface(args: {
  readonly sourceProject: AnalyzerProject;
  readonly sourceRegistry: NodeRegistry;
  readonly targetProject: CompilerProject;
  readonly targetRegistry: NodeRegistry;
  readonly sourceLoaded: LoadedVertaxProject;
  readonly targetLoaded: LoadedVertaxProject;
  readonly text: string;
  readonly candidateId?: StableId;
  readonly options: AnalyzeOptions & CompileOptions;
}): TranslationResult;
```
- With multiple surviving candidates and no `candidateId`, `needsSelection=true`, `surface` is absent, and Vertax never silently picks one.

- [ ] **Step 1: Write failing tests** showing English text analyzes to a MeaningGraph that generates back to English and into the existing reference conlang without pair-specific rules. Add an incompatible-shared-concept test and an ambiguous-source test that refuses to silently choose.
- [ ] **Step 2: Run focused tests** and verify the translation package/API is absent.
- [ ] **Step 3: Implement translation orchestration**: analyze source; validate shared semantics against target; if exactly one candidate (or an explicitly selected candidate) generate target; otherwise return candidates requiring confirmation.
- [ ] **Step 4: Ensure source syntax never reaches target generation** except through MeaningGraph/provenance. No direct source-token substitution API exists.
- [ ] **Step 5: Run translation tests, full suite, and typecheck**.
- [ ] **Step 6: Commit** with `feat: translate through shared MeaningGraph`.

### Task 7: Studio Analysis + Translation Workspace

**Files:**
- Create: `apps/studio/src/translation-workspace.ts`
- Create: `apps/studio/tests/translation-workspace.test.mjs`
- Modify: `apps/studio/src/app.ts`
- Modify: `apps/studio/src/project-tree.ts`
- Modify: `apps/studio/src/workspace-routing.ts`
- Modify: `apps/studio/public/studio.css`
- Modify: `apps/studio/server.mjs`

**Interfaces:**
- Consumes: pack index, analyzer, translation API.
- Produces: a Studio workspace for source/target selection, source text, candidate MeaningGraph inspection/selection, target generation, diagnostics, provenance, and navigation into language-pack resources.

- [ ] **Step 1: Write failing UI-model tests** for pack discovery, source/target selection, one-candidate translation, ambiguity requiring explicit selection, diagnostics, and `Open in Pack` navigation.
- [ ] **Step 2: Run focused tests** and verify the workspace is absent.
- [ ] **Step 3: Implement the workspace** without embedding English behavior in UI code. Pack capabilities drive which controls are enabled.
- [ ] **Step 4: Add browser-safe server endpoints** for listing bundled/local language packs and loading them read-only; editing still occurs through normal project workflows.
- [ ] **Step 5: Run UI tests, full suite/typecheck, `studio:build`, and HTTP smoke**.
- [ ] **Step 6: Commit** with `feat: add analysis and translation workspace`.

### Task 8: English Natural-Language Acceptance + Hardening Gate

**Files:**
- Create: `language-packs/english.vertax/tests/*.json`
- Create: `language-packs/english/acceptance.test.mjs`
- Create: `language-packs/english/hardening.test.mjs`
- Modify: `apps/cli/src/main.ts`
- Modify: `apps/cli/tests/cli.test.mjs`
- Modify: `language-packs/index.json`

**Interfaces:**
- Consumes everything from Tasks 1–7.
- Produces the Phase 7A release gate and CLI workflows for analyzing/testing a language pack.

- [ ] **Step 1: Build the persisted English corpus** with at least 150 cases spanning the grammatical families in the spec. Include both generation tests and surface-analysis expectations; include explicit ambiguity and unsupported-input cases.
- [ ] **Step 2: Write failing hardening tests** for 25-repeat deterministic candidate ordering/traces, schema-1 migration, deep clause/relative nesting within the existing safety limits, unknown-word behavior, and a repository scan proving no core/runtime/compiler/project-model branch keys off English language IDs/names.
- [ ] **Step 3: Add CLI commands** `analyze-project <pack> <text>` and `translate-project <source-pack> <target-pack> <text>`; ambiguous translation prints candidate IDs and exits nonzero until a candidate is selected via CLI option.
- [ ] **Step 4: Run the complete acceptance gate**: English project validation, ≥150 corpus cases, full repository tests, typecheck, Studio build/HTTP smoke, reference-language 30/30 tests, and English→reference-conlang translation examples.
- [ ] **Step 5: Commit** with `feat: prove Vertax with English natural-language pack`.

## Phase 7A Completion Gate

Phase 7A is complete only when all are true:

- English is an ordinary schema-2 `.vertax` project discoverable in `language-packs/index.json`.
- English has ≥500 lexemes and ≥150 persisted acceptance cases.
- The same English pack generates and analyzes the covered subset.
- Ambiguous English can return multiple MeaningGraph candidates.
- English analysis can drive the existing reference conlang generator through shared `sem:*` concepts.
- No language-pair translation rules exist.
- No English-specific branch exists in core/runtime/compiler/project-model.
- Existing generation-only projects still migrate and run unchanged.
- Phase 6 reference-language tests remain green.

**After this plan:** Phase 7B authors Spanish and Turkish with the same APIs, then proves English↔Spanish and English↔Turkish translation before desktop packaging.
