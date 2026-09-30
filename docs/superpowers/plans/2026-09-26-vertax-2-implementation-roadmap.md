# Vertax 2 Implementation Roadmap

**Spec:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`

The approved Vertax 2 design spans several independently reviewable subsystems. Implementation is therefore split into plans that each leave behind working, testable software.

## Plan sequence

1. **Core Vertical Slice**
   - Headless typed compiler kernel.
   - MeaningGraph core types.
   - Rules, node execution, scopes, requirements, fixed-point compilation.
   - Basic morphology and surface realization.
   - Provenance trace and diagnostics.
   - CLI plus a reference-conlang example that compiles a MeaningGraph to `person'vo duru esi'cook food`.
   - This is the architecture proof.

2. **Project Model, Lexicon, Tables, and Persistence**
   - Human-readable `.vertax` project structure.
   - Stable IDs and schema versioning.
   - Lexicon, valency, feature definitions, data tables.
   - Graph and Node Group serialization.
   - Import/export and migrations.
   - Project-level validation.

3. **Vertax Studio Graph Editor**
   - React + TypeScript application shell.
   - React Flow / xyflow canvas.
   - Typed ports, Node Shelf, Inspector, hierarchy/breadcrumbs.
   - Graph authoring for rules and Node Groups.
   - Static graph validation and editor undo/redo.

4. **Sentence Lab, Meaning Composer, and Debugger**
   - Form/tree/graph Meaning Composer.
   - Compile controls and output views.
   - Live Object Inspector.
   - Trace scrubber, scope/requirement viewer, breakpoints.
   - Diagnostics UI and save-as-test workflow.

5. **Morphology, Phonology, and Surface Authoring**
   - Full authoring node library for morphs, allomorphy, zero morphs, phonological environments, stress/syllabification hooks, spelling, spacing, punctuation, and source maps.
   - Gloss and structure outputs.

6. **Reference Conlang Acceptance + 1.0 Hardening**
   - Encode the current reference conlang without Vertax source-code special cases.
   - Cover complement calls, conjoining, recursion, nested clauses, `vo`, relational verbs, comparison, modality, coordination tails, coreference, etc.
   - Performance, determinism, recursion safety, project migrations, accessibility, error copy, test coverage.

7. **Desktop Packaging and Release**
   - Tauri 2 desktop shell.
   - Native open/save flows.
   - Import/export Node Groups.
   - Packaging, release checks, and distributable builds.

The plans are intentionally ordered so the compiler is proven before the editor becomes expensive to change.
