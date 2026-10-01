# Vertax 2 — recovered natural-language development checkpoint

This repository is a **recovered development branch**, not the original complete Phase 7A history. The original Phase 4–6 source checkout was lost; this branch was reconstructed from the surviving Phase 3 ZIP. It is deliberately kept separate from that older `main` until the missing release requirements are rebuilt and independently verified.

## Current verified capabilities

- Deterministic, graph-driven **four-stage generation**: Grammar → Morphology → optional Phonology → Surface. Older three-stage projects continue to run unchanged. `phon.from-morphs` exposes boundary and zero-morph tokens; the recovered generic phonology library supplies boundary-aware environment matching, replacement, deletion, insertion, metathesis, assimilation, stress, syllabification, harmony, lenition and fortition. These primitives operate on structured phonological tokens; they do **not** establish that every capability and test from the lost original Phase 5 was recovered.
- Persisted, executable `node-group:<id>` with typed ports, parameter defaults, nesting and recursion diagnostics.
- Branch-safe graph scheduling: inactive branches do not masquerade as cycles, and variadic collectors wait for all producers.
- A language-neutral reverse-analysis pipeline, English lexicon/grammar pack and translation through confirmed MeaningGraph candidates.
- A **bounded** English pack with a **405-case persisted corpus**. Its original 35 fixed grammar patterns are now complemented by 16 persisted **compositional productions** for reusable noun phrases, recursively stacked adjectives/adverbs, simple transitive verb phrases, copular states, prepositional phrases, and genuinely ambiguous PP attachments. The same rules combine across different nouns, adjectives and verbs without new whole-sentence templates. It is **not unrestricted English**: lexical valency, more word-order variation, arbitrary subordinate structures, and full generation parity remain development work.
- Source-language analysis preserves lexical alternatives such as the present/past form *read*; a source phrase with two syntactic derivations of the **same meaning** is shown once, while different coreference or PP attachments remain distinct. Both fixed and compositional parsers have explicit ambiguity budgets and reject non-consuming category cycles.
- Studio offers a separate **Analyze only** action that exposes all English MeaningGraph interpretations even when target-language generation does not yet cover the corresponding sentence. The read-only `/api/analyze` route works against catalog-listed language packs and returns source-analysis diagnostics independently of translation.
- A new, genuinely project-authored **reference-conlang recovery subset** at `examples/reference-language.vertax`. It includes 34 authored word patterns, a reusable persisted Node Group, shared semantic concepts, lexical forms, and **59 Meaning→Surface persisted cases** for interrogatives, tense/aspect, negation, pronouns, an imperative, recursive possession (up to six levels in the corpus), nested modality, and the recovered complement/conditional mechanisms. Its canonical sentence remains `person'vo duru esi'cook food`.
- Generic authored word patterns can now expand nested semantic role targets (including many-valued lists with separators), attach bound morphology to the expanded final word, and track typed nested Scope/Requirement obligations. Recursive semantic cycles and unexpanded structured roles return explicit diagnostics. This logic is not tied to the reference conlang.
- Complement calls resolve typed requirements through nested scopes, and structural conditional relations require a `clause: conditional` semantic feature on their subordinate event. The project places the `-sa` affix on a personal conditional's subject (including a recursively possessed subject) or on the verb for an impersonal conditional. Conditional and consequent negation stay separate. `requiredFeatures` on a role expansion is a **generic project-authored** constraint, not a conlang-specific runtime branch.
- **Dynamic coordination** uses an authored `SemanticList` with a `mode` feature (`add`, `alternative`, or `contrast`) and a `members` role containing at least two semantic objects. A generic role expansion attaches the lexical tail operator to each *following* member; nested lists, clauses, and recursively possessed members preserve their meaning.
- **Comparison** uses an authored `Relation` with roles `first`, `property`, and `second` plus `degree: more | less | equal`. The attested `-pu`, `-mo`, and `-ga` suffixes attach to the *final word of the first comparison subject*. Property-superlative `degree: highest | lowest` instead attaches `-pu` or `-mo` directly to the property form. The original comparative gap and the exact lexical realization of properties beyond this limited template are not yet independently validated.
- **IMPORTANT: not canonical vocabulary.** Coordination stems `⟦ADD⟧`, `⟦OR⟧`, `⟦BUT⟧` and illustrative property `⟦TALL⟧` are conspicuous placeholders, **not attested conlang words**. Their lexicon entries include `metadata.status: provisional`. Replacing their `citation` forms in `lexicon/lexicon.json` changes generated text without any compiler source changes. The `scripts/generate_reference_pack.py` fixture generator reproduces these provisional entries and all 59 persisted cases, and an automated parity test prevents it from silently deleting authored constructions.
- English → reference-conlang translation using the same generic compiler, including present, past, future, progressive, negative, pronoun and perfect forms when source analysis produces supported concepts.
- Studio Analysis / Translation exposes a read-only catalog with English and the reference-conlang subset as selectable packs. Both can be opened for inspection like ordinary `.vertax` projects.
- **Restored Sentence Lab / Meaning Composer:** project navigation offers Form/Tree/Graph views over one confirmed MeaningGraph; compilation exposes Final, Gloss (including `∅`), Structure, Trace and Errors panels, breakpoint-aware immutable rule snapshots, scope/Requirement inspections, and source-mapped final spans. Successful results can be saved as persisted project tests. The Test workspace runs project tests.
- **Recovered Studio realization authoring:** phonology and Surface nodes have human labels, search categories, typed parameter controls (including an available-table picker), and an advanced JSON editor. Orthography can use project spelling tables, explicit boundary glyphs, capitalization, punctuation and provenance-preserving rewrites. This is a reconstruction, not an assertion of parity with the lost original UI.
- Browser module import closure is tested to exclude Node-only filesystem dependencies; the Studio HTTP surface is smoke-tested. A real interactive Chromium page run is blocked by the current sandbox browser policy, so end-user click-through remains an outstanding verification item.
- Generic persisted graph validation rejects dangling edges, bindings, duplicate graph-node IDs and missing Node Group dependencies.

## Try it

Requires Node.js, npm, and a TypeScript compiler (available to this repository in the development environment).

```bash
npm test
npm run typecheck
npm run studio
# Open http://127.0.0.1:4173 and select Analysis / Translation.
# Choose English and Analyze only to inspect the MeaningGraph independently
# of whether the target language can regenerate the entire sentence.
```

For headless translation:

```bash
npm run build
node dist/apps/cli/src/main.js validate-project examples/reference-language.vertax
node dist/apps/cli/src/main.js test-project examples/reference-language.vertax
node dist/apps/cli/src/main.js analyze-project language-packs/english.vertax "The person cooked the food."
node dist/apps/cli/src/main.js translate-project language-packs/english.vertax examples/reference-language.vertax "The person cooked the food."
# person cookin food
node dist/apps/cli/src/main.js translate-project language-packs/english.vertax examples/reference-language.vertax "She cooked the food."
# nuko cookin food
```

The reference `.vertax` generation rules are in `examples/reference-language.vertax/node-groups/reference-clause.json`, its lexicon in `lexicon/lexicon.json`, and its tests in `tests/`. The `scripts/generate_reference_pack.py` script reproduces its authored resource documents; it does not add reference-language grammar branches to the compiler.

## Critical gaps before full Phase 7A / desktop release

1. Rebuild the rest of the **original Phase 6 reference conlang**, including conjoining/word-boundary details for actual complement callers, full combinations of conditional/tense/aspect features, dynamic coordination's *attested lexical stems*, full comparative gap behavior, semantic definiteness and attested possession trails. Generic recursion, typed modal and complement scopes, basic possessive chains, and **bounded** conditional realization are now implemented. The current 59 cases are a **new replacement corpus**, not the original tests that were lost. To avoid fabricating vocabulary, the new complement tests reuse the attested `duru` form as a **provisional sample caller**; its lexical/conjoining semantics and exact wording, as well as the complex possession/stacked modality surface forms, still require review against the author's complete grammar.
2. **Review the recovered Sentence Lab and phonology implementation against the lost Phase 4–5 specification**. The new debugger, editor, sound-rule nodes and source-mapped orthography are functional and regression-tested, but original coverage cannot be certified from the surviving files. A full real-browser manual interaction test remains to be run outside this sandbox (Chromium navigation here reports `ERR_BLOCKED_BY_ADMINISTRATOR`). Rebuild any unverified full-morphology/allomorphy features before claiming full original Phase 5 parity.
3. Generalize the English parser beyond its known bounded templates, review lexicon inflections, expand cross-linguistic semantic coverage, and perform independent linguistic evaluation before claiming unrestricted English/Spanish/Turkish translation.
4. Complete all native desktop packaging, installability, project life-cycle and release testing in the later desktop phase.

The source-code `examples/reference-slice` fixture still contains the original `ref.*` compatibility nodes; **the new canonical reference-language project never uses them**. Removing that fixture safely is separate compatibility work, so do not claim the repository already satisfies the original source-exception removal gate.

## Recovery and Git history

When exporting a recovery ZIP, include `.git` so branch and commit history survive across sandbox resets. The reconstructed history is **not** the lost original Phase 4–7A history. The recovery branch is intentionally separate from the original older `main`.

For English lexicon origins and review limitations, see `language-packs/english.vertax/LEXICON_SOURCES.md`.

### English compositional-analysis examples

The new grammar data is authored at `language-packs/english.vertax/graphs/grammaranalysis/en-grammaranalysis.json`, under `compositionalGrammar`. Repeated `NOM → Adjective NOM` and `VP → Adverb VP` rules model additional modifiers without adding entire sentences to the compiler. `VP → VP WITH_PP` and `NOM → NOM WITH_PP` retain both valid readings of *The girl saw the boy with the telescope.* The shared semantic fingerprint collapses derivational duplicates **without** merging interpretations that have different role attachments.

The persisted `en-composition-*.json` tests additionally assert meaning paths such as `agent.quality.0`, `agent.quality.1`, `instrument`, and `theme.association`. A `null` path expectation verifies an absent role. The optional real-browser script, `python scripts/browser-english-analysis-smoke.py`, exercises Analyze only and ambiguity selection on systems that allow local Chromium navigation; the current execution environment rejects Chromium navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`, so the portable server/UI model tests are the verified fallback.
