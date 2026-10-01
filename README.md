# Vertax 2 — recovered natural-language development checkpoint

This repository is a **recovered development branch**, not the original complete Phase 7A history. The original Phase 4–6 source checkout was lost; this branch was reconstructed from the surviving Phase 3 ZIP. It is deliberately kept separate from that older `main` until the missing release requirements are rebuilt and independently verified.

## Development priority: analysis-first

**English is the working reference for generic language analysis**, not the author's constructed language. Prioritize productive parsing across different grammatical constructions, lexical ambiguity, scoped/coreferential meaning, shared semantic interoperability, and independent linguistic evaluation. The reference-conlang subset remains a backwards-compatibility/stress-test fixture where it exposes general compiler gaps; its linguistic completion is not a prerequisite for broader English analysis or packaging. Never invent unconfirmed conlang forms to fill development checkboxes. Future natural-language packs must be built from the same public graph and lexicon APIs, not special-cased in runtime code.

## Current verified capabilities

- Deterministic, graph-driven **four-stage generation**: Grammar → Morphology → optional Phonology → Surface. Older three-stage projects continue to run unchanged. `phon.from-morphs` exposes boundary and zero-morph tokens; the recovered generic phonology library supplies boundary-aware environment matching, replacement, deletion, insertion, metathesis, assimilation, stress, syllabification, harmony, lenition and fortition. These primitives operate on structured phonological tokens; they do **not** establish that every capability and test from the lost original Phase 5 was recovered.
- Persisted, executable `node-group:<id>` with typed ports, parameter defaults, nesting and recursion diagnostics.
- Branch-safe graph scheduling: inactive branches do not masquerade as cycles, and variadic collectors wait for all producers.
- A language-neutral reverse-analysis pipeline, English lexicon/grammar pack and translation through confirmed MeaningGraph candidates.
- A **bounded** English pack with a 380-case persisted corpus. It is not unrestricted English. Generic reverse analysis now preserves *all compatible lexical readings* through syntax constraints; the English pack includes distinct financial-bank versus river-bank senses and requests disambiguation for an otherwise unresolved sentence. The grammar still relies on fixed-length templates, which is the next generalization target.
- A new, genuinely project-authored **reference-conlang recovery subset** at `examples/reference-language.vertax`. It includes 34 authored word patterns, a reusable persisted Node Group, shared semantic concepts, lexical forms, and **59 Meaning→Surface persisted cases** for interrogatives, tense/aspect, negation, pronouns, an imperative, recursive possession (up to six levels in the corpus), nested modality, and the recovered complement/conditional mechanisms. Its canonical sentence remains `person'vo duru esi'cook food`.
- Generic authored word patterns can now expand nested semantic role targets (including many-valued lists with separators), attach bound morphology to the expanded final word, and track typed nested Scope/Requirement obligations. Recursive semantic cycles and unexpanded structured roles return explicit diagnostics. This logic is not tied to the reference conlang.
- Complement calls resolve typed requirements through nested scopes, and structural conditional relations require a `clause: conditional` semantic feature on their subordinate event. The project places the `-sa` affix on a personal conditional's subject (including a recursively possessed subject) or on the verb for an impersonal conditional. Conditional and consequent negation stay separate. `requiredFeatures` on a role expansion is a **generic project-authored** constraint, not a conlang-specific runtime branch.
- **Dynamic coordination** uses an authored `SemanticList` with a `mode` feature (`add`, `alternative`, or `contrast`) and a `members` role containing at least two semantic objects. A generic role expansion attaches the lexical tail operator to each *following* member; nested lists, clauses, and recursively possessed members preserve their meaning.
- **Comparison** uses an authored `Relation` with roles `first`, `property`, and `second` plus `degree: more | less | equal`. The attested `-pu`, `-mo`, and `-ga` suffixes attach to the *final word of the first comparison subject*. Property-superlative `degree: highest | lowest` instead attaches `-pu` or `-mo` directly to the property form. The original comparative gap and the exact lexical realization of properties beyond this limited template are not yet independently validated.
- **IMPORTANT: not canonical vocabulary.** Coordination stems `⟦ADD⟧`, `⟦OR⟧`, `⟦BUT⟧` and illustrative property `⟦TALL⟧` are conspicuous placeholders, **not attested conlang words**. Their lexicon entries include `metadata.status: provisional`. Replacing their `citation` forms in `lexicon/lexicon.json` changes generated text without any compiler source changes. The `scripts/generate_reference_pack.py` fixture generator reproduces these provisional entries and all 59 persisted cases, and an automated parity test prevents it from silently deleting authored constructions.
- English → reference-conlang translation using the same generic compiler, including present, past, future, progressive, negative, pronoun and perfect forms when source analysis produces supported concepts.
- Studio Analysis / Translation exposes a read-only catalog with English and the reference-conlang subset as selectable packs. Both can be opened for inspection like ordinary `.vertax` projects.
- **Restored Sentence Lab / Meaning Composer:** project navigation offers Form/Tree/Graph views over one confirmed MeaningGraph; compilation exposes Final, Gloss (including `∅`), Structure, Trace and Errors panels, breakpoint-aware immutable rule snapshots, scope/Requirement inspections, and source-mapped final spans. Successful results can be saved as persisted project tests. The Test workspace runs project tests.
- **Recovered morphology authoring:** root, affix/prefix/suffix, linked circumfix, zero morph, allomorph selection, ordering, fusion, reduplication, mutation and semantic-controller agreement are generic graph primitives. Selection ranks candidate constraints by **specificity → numeric priority → non-fallback**, with an error for unresolved ties; records can be stored in project data tables. Fusion/reduplication source identities survive phonology into Surface source maps.
- **Recovered Studio realization authoring:** Morphology, Phonology and Surface nodes have human labels, search categories, typed parameter controls (including an available-table picker), and an advanced JSON editor. Orthography can use project spelling tables, explicit boundary glyphs, capitalization, punctuation and provenance-preserving rewrites. This is a reconstruction, not an assertion of parity with the lost original UI.
- Studio workflow regressions now cover morphology-node search/insertion/typed parameters/wiring/export/import/undo/redo and simulated DOM pointer-drag/pan transactions. Each drag/pan is committed once on release, and the port resolver handles input and output sockets sharing the same name. The Studio HTTP surface and browser module import closure are also tested. **A real Chromium click-through under normal URL navigation remains unverified** because this sandbox refuses localhost and file navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. An injected-Chromium pass now exercises the emitted browser modules with real mouse/keyboard events and a proxy to the actual local Studio API, including editable MeaningGraph Form/Tree/Graph views, Phonology authoring, Surface table selection, trace/provenance inspection, and Save-as-test → export/import → project save → executable corpus verification.
- Generic persisted graph validation rejects dangling edges, bindings, duplicate graph-node IDs and missing Node Group dependencies.

## Try it

Requires Node.js, npm, and a TypeScript compiler (available to this repository in the development environment).

```bash
npm test
npm run typecheck
npm run studio
# Open http://127.0.0.1:4173 and select Analysis / Translation.
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


### Morphology authoring in Studio

Open Studio, choose **Morphology**, then press **Space** on the graph canvas and search for **Select allomorph**. Create and connect it to a `MorphSequence` producer. The Inspector exposes a project **Allomorph table** picker or **Candidate rules (JSON)**. A candidate list can look like:

```json
[
  {"form":"went","when":{"tense":"past"},"priority":2},
  {"form":"go","fallback":true}
]
```

`when` compares against typed morph features, not letters in the eventual surface string. Exact ties are rejected with `AMBIGUOUS_ALLOMORPH`; absent matches report `NO_MATCHING_ALLOMORPH`. An empty selected form remains an explicit zero morph. Prefixes, suffixes, circumfixes, fusion, and reduplication are abstract until Phonology/Surface determine boundaries and spelling. The Inspector retains an advanced JSON fallback, and the project can be exported as `.vertax.json`.

For a true on-device browser acceptance pass, start `npm run studio` and run `python scripts/studio-browser-smoke.py` after installing Playwright and its Chromium browser locally. The sandbox used for recovery blocks browser URL navigation, so a **normal navigated browser pass remains required before release**.

In restricted CI, an additional **real Chromium DOM/interaction pass** can run without browser navigation:

```bash
npm run studio:build
node scripts/studio-offline-bundle.mjs
python scripts/studio-browser-injected-smoke.py
```

It loads the emitted Studio browser module closure and real Studio HTML/CSS into Chromium `about:blank`, then proxies UI API calls to a temporary *real* Studio server. It tests drag, pan, port wiring, Node Shelf, typed Inspector, Undo/Redo, English→conlang translation and ambiguity, opening packs, Phonology node authoring, Surface table selection, Meaning Composer Form/Tree/Graph edits affecting actual compilation, Sentence Lab trace/source provenance, test authoring, import/export and Save. The isolated saved project must then execute all 59 reference cases plus the newly authored test (60/60). The save target is isolated in a temporary folder, so the canonical packs are never overwritten. The generated `.studio-browser-bootstrap.js` and `.studio-browser-screenshot.png` are ignored. **This does not verify a normal browser navigation or resource loading.** Direct Chromium navigation to both localhost and `file://` was retried in this sandbox and returned `net::ERR_BLOCKED_BY_ADMINISTRATOR`; an unrestricted on-device navigation pass is still a separate release gate.

## Critical gaps before full Phase 7A / desktop release

1. **Generalize English analysis beyond fixed-length surface templates**: compositional noun/verb phrases, productive embedding, agreement and inflection, PP/relative attachment, quantifier and coreference scope, and a representative held-out corpus with hand-reviewed semantics. Report what fails instead of guessing a single meaning. Broadened English analysis takes precedence over enlarging the conlang fixture.
2. Review lexicon inflections and polysemy, expand cross-linguistic semantic contracts, and perform independent linguistic evaluation before claiming unrestricted English/Spanish/Turkish translation. The current multiple-sense English example proves hypothesis preservation, not general word-sense disambiguation.
3. Compare the recovered Sentence Lab, phonology and morphology APIs against the surviving original specs and finish the browser navigation/release checks. The injected-Chromium pass is real interaction testing but not an ordinary browser navigation smoke.

4. Complete all native desktop packaging, installability, project life-cycle and release testing in the later desktop phase.

The 59-case reference-conlang fixture stays as opt-in generic-engine regression coverage. Attested lexical/conjoining details and complex possession/modality surface forms are still provisional; only revisit them when they uncover a general capability gap or the author explicitly requests language work.

The source-code `examples/reference-slice` fixture still contains the original `ref.*` compatibility nodes; **the new canonical reference-language project never uses them**. Removing that fixture safely is separate compatibility work, so do not claim the repository already satisfies the original source-exception removal gate.

## Recovery and Git history

When exporting a recovery ZIP, include `.git` so branch and commit history survive across sandbox resets. The reconstructed history is **not** the lost original Phase 4–7A history. The recovery branch is intentionally separate from the original older `main`.

For English lexicon origins and review limitations, see `language-packs/english.vertax/LEXICON_SOURCES.md`.
