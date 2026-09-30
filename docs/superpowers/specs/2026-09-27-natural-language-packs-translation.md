# Vertax Natural-Language Packs and Translation Specification

**Status:** Approved direction from conversation; implementation split into Phase 7A and Phase 7B.
**Product:** Vertax 2
**Purpose:** Prove Vertax can model real natural languages bidirectionally and translate through MeaningGraph without language-pair rules.

## 1. Product requirement

Vertax must ship with real, inspectable language packs authored using the same project, graph, lexicon, table, Node Group, morphology, phonology, and surface mechanisms available to users.

A bundled language must not be a hidden source-code special case. Users must be able to open it in Studio, inspect its grammar, clone it, modify it, and use it as the basis for a conlang.

The first default-language target set is:

- English
- Spanish
- Turkish

English is implemented first in Phase 7A. Spanish and Turkish follow in Phase 7B.

## 2. Translation architecture

Translation must use MeaningGraph as an interlingua:

```text
Source text
  ↓
Source-language analysis project
  ↓
MeaningGraph candidate(s)
  ↓
User/context confirmation when ambiguous
  ↓
Target-language generation project
  ↓
Target text
```

Vertax must never require English→Spanish, Spanish→Turkish, or other language-pair transformation rules.

The generation pipeline remains:

```text
MeaningGraph → Grammar → Morphology → Phonology → Surface
```

The initial text-analysis pipeline is:

```text
SourceText
→ OrthographyAnalysis
→ MorphologyAnalysis
→ GrammarAnalysis
→ MeaningAnalysis
→ SemanticGraphValue candidate(s)
```

Speech recognition / acoustic analysis is outside this milestone.

## 3. Ambiguity

Natural-language ambiguity is first-class. Analysis may return multiple valid MeaningGraph candidates.

Example:

> I saw the man with the telescope.

Vertax must be capable of preserving at least the instrument attachment and noun-phrase attachment readings rather than silently choosing one.

Candidates are deterministic and provenance-carrying. The core must not invent probabilistic confidence scores. A language pack may eliminate structurally impossible analyses, but surviving semantic ambiguity remains visible for confirmation.

## 4. Shared semantics

Cross-language translation requires stable semantic identifiers shared between packs.

Language-specific lexemes remain local. Concepts intended to translate across packs use a shared namespace such as:

- `sem:entity.person`
- `sem:entity.book`
- `sem:event.give`
- `sem:event.see`
- `sem:property.red`

Pack-specific concepts may use language-specific namespaces. If a target pack cannot realize a semantic concept, translation must return an explicit diagnostic rather than substituting unrelated meaning.

Concept definitions with the same shared ID in two packs must be structurally compatible.

## 5. Language-pack rule

No core package may branch on a concrete language ID, locale, or language name.

Prohibited examples include:

```ts
if (language === "English")
if (locale === "en-US")
```

English-specific behavior belongs in the English `.vertax` project: its lexicon, tables, stage graphs, and Node Groups.

## 6. English Phase 7A scope

Phase 7A does not claim perfect unrestricted English parsing. It must provide a substantial, productive Standard American English core sufficient to demonstrate that Vertax models a real natural language rather than a sentence demo.

The English pack must include at minimum:

- at least 500 usable lexemes spanning function words and common nouns, verbs, adjectives, adverbs, and prepositions;
- regular noun number and possessive morphology;
- regular verb agreement and past morphology plus common irregulars;
- copular `be`, auxiliary `be/have/do`, and modal auxiliaries;
- present, past, future, progressive, perfect, and combinations needed by the acceptance corpus;
- declaratives, negation, yes/no questions, wh-questions;
- determiners and definiteness;
- pronouns and basic coreference;
- adjective/adverb modification;
- possession;
- prepositional phrases;
- coordination;
- comparison and superlatives;
- ditransitives;
- complement clauses;
- relative clauses;
- passive voice;
- capitalization and sentence punctuation.

The pack must contain a broad persisted corpus, not only ad hoc unit fixtures.

## 7. Analysis failure behavior

Unknown or unsupported input must not silently become a wrong translation.

Analysis results may contain:

- successful candidate(s);
- warnings for preserved unknown material;
- explicit ambiguity;
- explicit unsupported-construction diagnostics;
- zero candidates on failure.

Proper names and deliberately preserved unknown tokens may round-trip as source-backed semantic entities when the language pack defines that behavior.

## 8. Studio requirements

Studio must expose language packs as ordinary projects and provide a translation/analysis workspace that can:

- choose a source pack and target pack;
- enter source text;
- run analysis;
- inspect candidate MeaningGraphs;
- choose a candidate when ambiguous;
- generate target text;
- jump into the source or target pack's relevant graph/lexicon resources;
- show diagnostics and provenance.

## 9. Installation requirement

Desktop packaging occurs only after the natural-language proof.

The eventual installed application must bundle English, Spanish, and Turkish packs as ordinary readable Vertax projects (or read-only installed copies that can be cloned into editable projects). Removing/replacing a pack must not require changes to Vertax core.

## 10. Acceptance sequence

Phase 7A proves:

1. generic reverse-analysis architecture;
2. shared semantic IDs;
3. substantial English generation and analysis;
4. ambiguity preservation;
5. English MeaningGraph generation can drive another existing Vertax language project;
6. zero English-specific branches in core/runtime/compiler/project-model.

Phase 7B proves:

1. Spanish and Turkish are authored with the same generic facilities;
2. English↔Spanish and English↔Turkish translation uses only shared MeaningGraphs;
3. typologically different target generation does not preserve source-language syntax accidentally;
4. all three packs are suitable to bundle with the desktop application.
