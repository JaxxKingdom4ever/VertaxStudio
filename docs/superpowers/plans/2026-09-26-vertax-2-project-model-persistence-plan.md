# Vertax 2 Project Model, Lexicon, Tables, and Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Vertax's proven in-memory compiler into a human-readable, versioned `.vertax` project system that persists concepts, feature definitions, lexemes/valency, tables, rule graphs, Node Groups, tests, settings, and layout separately, then reconstructs the existing compiler project without changing compiler semantics.

**Architecture:** Add a new `@vertax/project-model` package above the existing core/runtime/compiler/primitives packages. Durable JSON documents use stable IDs and snake_case manifest fields; project loading decodes and validates documents, derives compiler-only indexes such as concept→lexeme mappings, and converts persisted stage documents into the existing `CompilerProject`. Filesystem concerns stay out of the compiler, graph layout stays separate from graph logic, and schema migration occurs before semantic validation.

**Tech Stack:** TypeScript, Node.js filesystem APIs, npm workspaces, Node's built-in test runner. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`

## Global Constraints

- Project files must remain human-readable and version-control-friendly.
- Stable IDs are authoritative; editable names/labels must not be used as durable references.
- Graph logic and graph layout must be stored separately; moving nodes cannot change compiler semantics.
- Vocabulary/data remain separate from executable rule logic: lexicons/tables/features store facts, graphs/rules store behavior.
- Existing compiler/runtime packages remain filesystem-agnostic.
- Loading an invalid project returns structured diagnostics rather than partially trusted compiler state.
- Save operations must not knowingly leave a partially rewritten project if serialization fails midway.
- Project schema versioning must support migration before normal validation.
- The loader may persist Phonology-stage data even though the current core pipeline does not yet execute a Phonology stage.
- Custom node implementations remain runtime registrations in this phase; serialized graphs persist their `typeId` references but do not serialize JavaScript functions.
- The existing reference-conlang compiler result `person'vo duru esi'cook food` must remain unchanged after a save/load round trip.

## Review Focus

1. **A manifest path contains `../` or an absolute path:** Task 5 must prove loading rejects traversal/out-of-root resource paths with `UNSAFE_PROJECT_PATH`.
2. **Two durable objects share the same stable ID across different project collections:** Task 7 must prove project validation emits `DUPLICATE_STABLE_ID` rather than letting one silently shadow the other.
3. **A lexeme references a missing concept or related lexeme:** Task 3 must prove resource validation emits `MISSING_CONCEPT_REFERENCE` / `MISSING_LEXEME_REFERENCE` and refuses compiler-resource construction.
4. **An old supported schema is loaded:** Task 6 must prove schema `0` migrates deterministically to schema `1`, while a future schema fails with `UNSUPPORTED_PROJECT_SCHEMA`.
5. **A save is interrupted before replacement:** Task 5 must prove saving writes to a sibling temporary directory and only replaces the destination after all documents serialize successfully.

---

## File Structure Locked by This Plan

```text
packages/
├── core-types/
│   └── src/
│       └── features.ts                 # extend feature-definition vocabulary only
├── primitives/
│   └── src/
│       ├── lexicon.ts                  # richer Lexeme + valency model
│       └── project-resources.ts        # concepts/features/typed tables + derived index
└── project-model/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── model.ts                    # durable project document types
    │   ├── manifest.ts                 # schema version + manifest decoder
    │   ├── resources.ts                # concepts/features/lexicon/tables conversion
    │   ├── graph-documents.ts          # graph/rule + layout documents
    │   ├── node-groups.ts              # portable NodeGroupDocument import/export shape
    │   ├── tests-model.ts              # persisted project test documents
    │   ├── migrations.ts               # schema migration registry
    │   ├── validation.ts               # whole-project cross-reference validation
    │   ├── io.ts                       # directory save/load + safe path resolution
    │   ├── compiler-adapter.ts         # LoadedVertaxProject -> CompilerProject
    │   ├── node-shims.d.ts             # temporary Node API typings for this dependency-free repo
    │   └── index.ts
    └── tests/
        ├── resources.test.mjs
        ├── graph-documents.test.mjs
        ├── node-groups.test.mjs
        ├── io.test.mjs
        ├── migrations.test.mjs
        ├── validation.test.mjs
        └── roundtrip.test.mjs
examples/
└── reference-slice/
    ├── project.ts                      # update Lexeme resource shape
    └── persisted-project.ts            # constructs persisted project fixture
apps/
└── cli/
    ├── src/main.ts                     # add `validate-project <path>` command
    └── tests/cli.test.mjs
```

---

### Task 1: Durable Resource Types and Rich Lexicon Model

**Files:**
- Modify: `packages/core-types/src/features.ts`
- Modify: `packages/primitives/src/lexicon.ts`
- Modify: `packages/primitives/src/project-resources.ts`
- Modify: `packages/primitives/src/index.ts`
- Modify: `examples/reference-slice/project.ts`
- Create: `packages/project-model/package.json`
- Create: `packages/project-model/tsconfig.json`
- Create: `packages/project-model/src/model.ts`
- Create: `packages/project-model/src/index.ts`
- Test: `packages/project-model/tests/resources.test.mjs`

**Interfaces:**
- Consumes: `StableId`, `FeatureBundle`, existing `Lexeme`, `ProjectResources`.
- Produces:
  - `interface DecodeResult<T> { value?: T; diagnostics: readonly Diagnostic[] }`
  - `interface ConceptDefinition { id: StableId; label: string; description?: string; semanticType?: string; metadata: Readonly<Record<string, unknown>> }`
  - `interface FeatureDefinition { id: StableId; label: string; allowedValues: readonly string[]; defaultValue?: string; allowedOn: readonly string[]; inheritance: "none" | "copy" | "scope" }`
  - `interface ValencySlot { role: string; acceptedTypes: readonly string[]; required: boolean; cardinality: "ONE" | "OPTIONAL" | "MANY" }`
  - enriched `Lexeme` with `features`, `valency`, `relatedLexemes`, `irregularRuleIds`, and `metadata`.
  - `interface DataTable { id: StableId; label: string; columns: readonly string[]; rows: readonly Readonly<Record<string, unknown>>[]; metadata: Readonly<Record<string, unknown>> }`
  - enriched `ProjectResources` containing `concepts`, `featureDefinitions`, typed `tables`, `lexemes`, and derived `conceptToLexemeIds`.

- [ ] **Step 1: Write failing resource-model tests**

Assert a fully populated Lexeme can express:

```text
conceptId = COOK
valency.agent = Entity required ONE
valency.theme = Entity optional ONE
relatedLexemes.event_noun = [COOKING]
irregularRuleIds = []
```

Also assert `ProjectResources.tables["tense"].rows` preserves structured data rather than flattening it.

- [ ] **Step 2: Run the resource tests and verify they fail**

Run:

```bash
npm run build && node --test packages/project-model/tests/resources.test.mjs
```

Expected: FAIL because the new project-model package/types do not exist.

- [ ] **Step 3: Implement the durable resource interfaces and enrich `Lexeme` / `ProjectResources`**

Keep fields immutable and JSON-serializable. Replace the old flat `relatedLexemeIds` field with labeled `relatedLexemes`.

- [ ] **Step 4: Update the existing reference-slice in-memory resources to the new Lexeme shape**

Use empty feature bundles, valency arrays, relationship maps, irregular rule arrays, and metadata where the example does not yet need data.

- [ ] **Step 5: Run resource tests plus the existing full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: all existing tests plus new resource tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core-types packages/primitives packages/project-model examples/reference-slice/project.ts

git commit -m "feat: define durable Vertax project resources"
```

---

### Task 2: Manifest, Stage Documents, and Layout Separation

**Files:**
- Create: `packages/project-model/src/manifest.ts`
- Create: `packages/project-model/src/graph-documents.ts`
- Modify: `packages/project-model/src/index.ts`
- Test: `packages/project-model/tests/graph-documents.test.mjs`

**Interfaces:**
- Consumes: `CompilerStage`, `GraphDefinition`, `RuleDefinition`, `StableId`.
- Produces:
  - `const CURRENT_PROJECT_SCHEMA_VERSION = 1`
  - `interface ProjectManifestV1 { schema_version: 1; id: StableId; name: string; version: string; default_language: string; graphs: Readonly<Partial<Record<CompilerStage, readonly string[]>>>; lexicons: readonly string[]; features: readonly string[]; concepts: readonly string[]; tables: readonly string[]; node_groups: readonly string[]; tests: readonly string[]; settings: string; layouts: readonly string[]; dependencies: readonly ProjectDependency[] }`
  - `interface ProjectDependency { id: string; version?: string }`
  - `interface StageGraphDocument { schema_version: 1; stage: CompilerStage; graph: GraphDefinition; rules: readonly RuleDefinition[] }`
  - `interface GraphLayoutDocument { schema_version: 1; graph_id: StableId; nodes: Readonly<Record<StableId, NodeLayout>>; viewport?: ViewportLayout }`
  - `function decodeProjectManifest(raw: unknown): DecodeResult<ProjectManifestV1>`
  - `function decodeStageGraphDocument(raw: unknown): DecodeResult<StageGraphDocument>`
  - `function decodeGraphLayoutDocument(raw: unknown): DecodeResult<GraphLayoutDocument>`

`ProjectManifestV1` uses these durable fields:

```text
schema_version
id
name
version
default_language
graphs
lexicons
features
concepts
tables
node_groups
tests
settings
layouts
dependencies
```

- [ ] **Step 1: Write failing document-decoder tests**

Assert:

- a valid manifest with snake_case keys decodes;
- missing `schema_version` returns `INVALID_PROJECT_MANIFEST`;
- a graph document preserves `GraphDefinition` node IDs/type IDs and rules;
- changing node coordinates in a `GraphLayoutDocument` does not change the serialized `StageGraphDocument` value.

- [ ] **Step 2: Run the graph/document tests and verify they fail**

Run:

```bash
npm run build && node --test packages/project-model/tests/graph-documents.test.mjs
```

Expected: FAIL because document decoders do not exist.

- [ ] **Step 3: Implement strict structural decoders for manifest, stage graph, and layout documents**

Use small explicit type guards; do not add a schema library dependency.

- [ ] **Step 4: Run graph/document tests and typecheck**

Run:

```bash
npm run build && node --test packages/project-model/tests/graph-documents.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/project-model/src/manifest.ts packages/project-model/src/graph-documents.ts packages/project-model/src/index.ts packages/project-model/tests/graph-documents.test.mjs

git commit -m "feat: define Vertax project documents"
```

---

### Task 3: Concepts, Features, Lexicon, Tables, and Compiler Resource Construction

**Files:**
- Create: `packages/project-model/src/resources.ts`
- Modify: `packages/project-model/src/index.ts`
- Expand: `packages/project-model/tests/resources.test.mjs`

**Interfaces:**
- Consumes: types from Task 1.
- Produces:
  - `interface ResourceDocuments { concepts: readonly ConceptDefinition[]; features: readonly FeatureDefinition[]; lexemes: readonly Lexeme[]; tables: readonly DataTable[] }`
  - `function decodeConcepts(raw: unknown): DecodeResult<readonly ConceptDefinition[]>`
  - `function decodeFeatures(raw: unknown): DecodeResult<readonly FeatureDefinition[]>`
  - `function decodeLexicon(raw: unknown): DecodeResult<readonly Lexeme[]>`
  - `function decodeDataTable(raw: unknown): DecodeResult<DataTable>`
  - `interface BuildResourcesResult { resources?: ProjectResources; diagnostics: readonly Diagnostic[] }`
  - `function buildProjectResources(documents: ResourceDocuments): BuildResourcesResult`

`buildProjectResources` derives `conceptToLexemeIds`; that index is never stored as authoritative project data.

- [ ] **Step 1: Add failing resource-decoder and cross-reference tests**

Assert:

```text
lexeme conceptId missing -> MISSING_CONCEPT_REFERENCE
related lexeme ID missing -> MISSING_LEXEME_REFERENCE
feature default outside allowedValues -> INVALID_FEATURE_DEFAULT
valid documents -> derived conceptToLexemeIds contains each lexeme once
```

- [ ] **Step 2: Run resource tests and verify they fail**

Run:

```bash
npm run build && node --test packages/project-model/tests/resources.test.mjs
```

Expected: FAIL on missing decoders/build function.

- [ ] **Step 3: Implement resource decoders and `buildProjectResources`**

Do not tolerate duplicate IDs inside one resource collection; return diagnostics instead of overwriting map entries.

- [ ] **Step 4: Run resource tests and full typecheck**

Run:

```bash
npm run build && node --test packages/project-model/tests/resources.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/project-model/src/resources.ts packages/project-model/src/index.ts packages/project-model/tests/resources.test.mjs

git commit -m "feat: decode Vertax lexical resources"
```

---

### Task 4: Node Group and Persisted Test Documents

**Files:**
- Create: `packages/project-model/src/node-groups.ts`
- Create: `packages/project-model/src/tests-model.ts`
- Modify: `packages/project-model/src/index.ts`
- Test: `packages/project-model/tests/node-groups.test.mjs`

**Interfaces:**
- Consumes: `PortDefinition`, `GraphDefinition`, `StableId`, compiler stage names.
- Produces:
  - `interface NodeGroupParameterDefinition { id: string; label: string; valueType: "string" | "number" | "boolean" | "json"; required: boolean; defaultValue?: unknown }`
  - `interface NodeGroupDocument { schema_version: 1; id: StableId; name: string; version: string; description?: string; inputs: readonly PortDefinition[]; outputs: readonly PortDefinition[]; parameters: readonly NodeGroupParameterDefinition[]; internal_graph: GraphDefinition; test_ids: readonly StableId[] }`
  - `interface PersistedTestDocument { schema_version: 1; id: StableId; name: string; input_stage: CompilerStage; input: unknown; expected_stage: CompilerStage; expected_output: unknown; mode: "fast" | "trace" | "strict"; assertions: readonly Readonly<Record<string, unknown>>[] }`
  - `decodeNodeGroupDocument(raw)` and `decodePersistedTestDocument(raw)`.
  - `serializeNodeGroupDocument(document): string` and `parseNodeGroupDocument(text): DecodeResult<NodeGroupDocument>` for portable `.vertaxnode.json` exchange.

- [ ] **Step 1: Write failing Node Group/test-document tests**

Assert a Node Group round-trips through JSON with stable IDs and the same internal graph, while omitting all canvas layout data.

Assert malformed port directions/cardinality return `INVALID_NODE_GROUP`.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm run build && node --test packages/project-model/tests/node-groups.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement portable Node Group and persisted-test document decoding/encoding**

This task serializes definitions only; it does not yet turn a Node Group into an executable runtime `NodeDefinition`.

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
npm run build && node --test packages/project-model/tests/node-groups.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/project-model/src/node-groups.ts packages/project-model/src/tests-model.ts packages/project-model/src/index.ts packages/project-model/tests/node-groups.test.mjs

git commit -m "feat: persist Vertax node groups and tests"
```

---

### Task 5: Safe Human-Readable Project Save and Load

**Files:**
- Create: `packages/project-model/src/io.ts`
- Create: `packages/project-model/src/node-shims.d.ts`
- Modify: `packages/project-model/src/model.ts`
- Modify: `packages/project-model/src/index.ts`
- Test: `packages/project-model/tests/io.test.mjs`

**Interfaces:**
- Consumes: all durable documents from Tasks 1–4.
- Produces:
  - `interface LoadedVertaxProject { manifest: ProjectManifestV1; concepts: Readonly<Record<StableId, ConceptDefinition>>; features: Readonly<Record<StableId, FeatureDefinition>>; lexemes: Readonly<Record<StableId, Lexeme>>; tables: Readonly<Record<StableId, DataTable>>; stageDocuments: readonly StageGraphDocument[]; layouts: Readonly<Record<StableId, GraphLayoutDocument>>; nodeGroups: Readonly<Record<StableId, NodeGroupDocument>>; tests: Readonly<Record<StableId, PersistedTestDocument>>; settings: Readonly<Record<string, unknown>> }`
  - `interface LoadProjectResult { project?: LoadedVertaxProject; diagnostics: readonly Diagnostic[] }`
  - `interface SaveProjectResult { diagnostics: readonly Diagnostic[]; success: boolean }`
  - `async function loadProject(rootPath: string): Promise<LoadProjectResult>`
  - `async function saveProject(rootPath: string, project: LoadedVertaxProject): Promise<SaveProjectResult>`
  - `interface SafePathResult { path?: string; diagnostics: readonly Diagnostic[] }`
  - `function resolveProjectPath(rootPath: string, manifestPath: string): SafePathResult`

Canonical v1 directory layout written by `saveProject`:

```text
<name>.vertax/
├── project.json
├── concepts/concepts.json
├── features/features.json
├── lexicon/lexicon.json
├── graphs/<stage>/<graph-id>.json
├── layouts/<graph-id>.json
├── tables/<table-id>.json
├── node-groups/<node-group-id>.json
├── tests/<test-id>.json
└── settings.json
```

- [ ] **Step 1: Write failing safe-path and filesystem round-trip tests**

Use a temporary directory and assert:

```text
../outside.json -> UNSAFE_PROJECT_PATH
/absolute/path -> UNSAFE_PROJECT_PATH
normal relative resource path -> accepted
```

Also assert saving a minimal project creates `project.json`, resource directories, and separate graph/layout files; loading reconstructs the same durable logical project.

- [ ] **Step 2: Add a failing atomic-save test**

Inject a project value that cannot be JSON-serialized (e.g. circular `settings` data) and assert an already-existing destination remains byte-for-byte unchanged after `saveProject` returns failure.

- [ ] **Step 3: Run IO tests and verify they fail**

Run:

```bash
npm run build && node --test packages/project-model/tests/io.test.mjs
```

Expected: FAIL.

- [ ] **Step 4: Implement safe path resolution and project loading**

Every manifest-controlled resource path must resolve inside `rootPath`; reject unsafe paths before reading them.

- [ ] **Step 5: Implement atomic directory save**

Serialize/write the complete project into a sibling temporary directory first. Replace the destination only after every document has been written successfully. Clean up temporary output on failure.

- [ ] **Step 6: Run IO tests and full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/project-model/src/io.ts packages/project-model/src/node-shims.d.ts packages/project-model/src/model.ts packages/project-model/src/index.ts packages/project-model/tests/io.test.mjs

git commit -m "feat: save and load Vertax projects"
```

---

### Task 6: Schema Migration Infrastructure

**Files:**
- Create: `packages/project-model/src/migrations.ts`
- Modify: `packages/project-model/src/io.ts`
- Modify: `packages/project-model/src/index.ts`
- Test: `packages/project-model/tests/migrations.test.mjs`

**Interfaces:**
- Consumes: raw project manifest JSON before v1 decoding.
- Produces:
  - `interface ProjectMigration { from: number; to: number; migrate(raw: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> }`
  - `class MigrationRegistry`
  - `function createDefaultMigrationRegistry(): MigrationRegistry`
  - `interface MigrationResult { manifest?: ProjectManifestV1; diagnostics: readonly Diagnostic[] }`
  - `function migrateManifest(raw: unknown, registry: MigrationRegistry): MigrationResult`

Built-in schema `0 → 1` migration:

- retains stable ID/name/version/default language/resource path fields;
- adds empty `node_groups`, `layouts`, and `dependencies` when absent;
- sets `schema_version` to `1`.

- [ ] **Step 1: Write failing migration tests**

Assert:

```text
schema 0 -> exactly schema 1 with default empty new collections
schema 1 -> unchanged logical manifest
schema 2 while current=1 -> UNSUPPORTED_PROJECT_SCHEMA
no migration path -> PROJECT_MIGRATION_PATH_MISSING
```

- [ ] **Step 2: Run migration tests and verify they fail**

Run:

```bash
npm run build && node --test packages/project-model/tests/migrations.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement migration registry and default v0→v1 migration**

Migration order must be deterministic and step one version at a time.

- [ ] **Step 4: Apply migration before manifest decoding inside `loadProject`**

Future schema versions fail before any resource files are loaded.

- [ ] **Step 5: Run migration + IO tests and typecheck**

Run:

```bash
npm run build && node --test packages/project-model/tests/migrations.test.mjs packages/project-model/tests/io.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/project-model/src/migrations.ts packages/project-model/src/io.ts packages/project-model/src/index.ts packages/project-model/tests/migrations.test.mjs

git commit -m "feat: migrate Vertax project schemas"
```

---

### Task 7: Whole-Project Validation and Compiler Adapter

**Files:**
- Create: `packages/project-model/src/validation.ts`
- Create: `packages/project-model/src/compiler-adapter.ts`
- Modify: `packages/project-model/src/index.ts`
- Test: `packages/project-model/tests/validation.test.mjs`

**Interfaces:**
- Consumes: `LoadedVertaxProject`, `CompilerProject`, `StageProject`.
- Produces:
  - `function validateProject(project: LoadedVertaxProject): readonly Diagnostic[]`
  - `interface CompilerAdapterResult { project?: CompilerProject; diagnostics: readonly Diagnostic[] }`
  - `function toCompilerProject(project: LoadedVertaxProject): CompilerAdapterResult`

Validation covers:

- duplicate durable IDs across concepts/features/lexemes/tables/graphs/node groups/tests;
- missing rule graph references;
- stage mismatch between RuleDefinition and StageGraphDocument;
- graph layout references to missing graph/node IDs (Warning for missing layout nodes; Error if layout targets missing graph);
- lexeme concept/related-lexeme references;
- Node Group `test_ids` references;
- manifest-listed document IDs/path results already loaded.

`toCompilerProject` requires Grammar, Morphology, and Surface stage projects and returns `MISSING_REQUIRED_STAGE` if any are absent. Persisted Phonology stage data remains on `LoadedVertaxProject` but is not inserted into the current three-stage `CompilerProject` yet.

- [ ] **Step 1: Write failing project-validation tests**

Assert two objects in different collections using ID `shared-id` produce `DUPLICATE_STABLE_ID`.

Assert a rule pointing to a nonexistent graph produces `MISSING_RULE_GRAPH_REFERENCE`.

Assert a valid project converts into a `CompilerProject` whose stage rules/graphs and resources match the loaded project.

- [ ] **Step 2: Run validation tests and verify they fail**

Run:

```bash
npm run build && node --test packages/project-model/tests/validation.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement whole-project validation**

Validation must accumulate independent diagnostics instead of stopping at the first problem.

- [ ] **Step 4: Implement `toCompilerProject`**

Run validation first; do not return a compiler project if any Error/Fatal diagnostic exists.

- [ ] **Step 5: Run validation tests and typecheck**

Run:

```bash
npm run build && node --test packages/project-model/tests/validation.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/project-model/src/validation.ts packages/project-model/src/compiler-adapter.ts packages/project-model/src/index.ts packages/project-model/tests/validation.test.mjs

git commit -m "feat: validate persisted Vertax projects"
```

---

### Task 8: Reference Project Save/Load/Compile Acceptance and CLI Validation

**Files:**
- Create: `examples/reference-slice/persisted-project.ts`
- Create: `packages/project-model/tests/roundtrip.test.mjs`
- Modify: `apps/cli/src/main.ts`
- Modify: `apps/cli/tests/cli.test.mjs`

**Interfaces:**
- Consumes: `saveProject`, `loadProject`, `toCompilerProject`, existing reference-slice node registration and MeaningGraph.
- Produces:
  - `export const referencePersistedProject: LoadedVertaxProject`
  - CLI command: `validate-project <path>`

- [ ] **Step 1: Write the failing end-to-end persisted-project test**

Test flow:

```text
referencePersistedProject
→ saveProject(tempPath)
→ loadProject(tempPath)
→ validateProject
→ toCompilerProject
→ register core + reference node definitions
→ compileMeaningGraph(whoIsCookingFood)
```

Assert final surface is exactly:

```text
person'vo duru esi'cook food
```

Also assert the logical graph documents before save and after load are deeply equal while layout coordinates may be changed independently without changing compiler output.

- [ ] **Step 2: Run the round-trip test and verify it fails**

Run:

```bash
npm run build && node --test packages/project-model/tests/roundtrip.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Build the persisted reference fixture entirely through Phase 2 public document types**

Do not add reference-language branches to the project-model or compiler packages.

- [ ] **Step 4: Add failing CLI tests for `validate-project <path>`**

Assert a valid saved project prints:

```text
Valid Vertax project: <project name> (schema 1)
```

and exits `0`; an invalid project prints structured diagnostic codes and exits non-zero.

- [ ] **Step 5: Implement the CLI validation command**

Keep existing `compile` and `trace` behavior unchanged.

- [ ] **Step 6: Run the full workspace verification**

Run:

```bash
npm test
npm run typecheck
npm run demo
```

Expected:

- all tests pass;
- typecheck passes;
- demo still prints exactly `person'vo duru esi'cook food`.

- [ ] **Step 7: Commit**

```bash
git add examples/reference-slice/persisted-project.ts packages/project-model/tests/roundtrip.test.mjs apps/cli

git commit -m "test: persist and reload a compiling Vertax project"
```

---

## End State of This Plan

After Phase 2, Vertax has a real project boundary:

```text
.vertax directory
→ schema migration
→ structural decoding
→ safe resource loading
→ cross-reference validation
→ derived ProjectResources
→ CompilerProject adapter
→ existing deterministic compiler
```

A project can be saved as readable JSON, diffed in Git, renamed without breaking ID references, laid out visually without modifying graph logic, exported/imported at the Node Group document level, migrated from the supported prototype schema, validated headlessly, and compiled after a disk round trip.

The graphical editor still does not exist. That remains Phase 3, which can now author against a stable project/file model rather than inventing persistence inside the UI.
