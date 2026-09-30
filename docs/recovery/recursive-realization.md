# Recovered recursive realization authoring

This document describes the **recovered, bounded** generic Word Realization primitive. It does **not** claim to reproduce all of the original Phase 6 grammar or settle unverified reference-conlang forms.

A persisted `grammar.realize-words` node accepts project-authored `patterns`. A pattern's `words` list can now contain ordinary lexical words (`[ { "root": true } ]`) **or a semantic role expansion** (`{ "expandRole": "complement" }`). Expansion recursively applies the same authored pattern set to each target of that role, in order. A plain Entity/Unknown/Reference with no nested roles may use its project lexicon citation form as a leaf. Other unhandled structures fail with `UNSUPPORTED_SEMANTIC_PATTERN` rather than vanishing.

Example: a noun with an arbitrary-depth chain of possessors:

```json
{
  "id": "noun-with-possessor",
  "conceptId": "*",
  "valueTypes": ["Entity", "Reference"],
  "requiredRoles": ["possessor"],
  "words": [
    {
      "expandRole": "possessor",
      "suffix": [{ "conceptId": "sem:op.possession", "kind": "Suffix", "joinBefore": "'" }]
    },
    [{ "root": true }]
  ]
}
```

This is a **project grammar pattern**, not a hard-coded `if (language === ...)`. The concrete marker `lez` lives in the reference project's lexicon. The surface rule, not the compiler, determines the orthographic apostrophe. The basic recursive spelling demonstrated here is *provisional* pending review against the complete conlang design, particularly possession trails.

For a role holding a list of referents, `separatorWords` is a list of lexical words inserted **only between** expanded items, e.g. `{ "expandRole": "items", "separatorWords": [[{ "conceptId": "sem:conj.and" }]] }`. This is a **generic illustrative marker**, not an assertion that the reference language has a lexeme `and` or uses English coordination rules.

A dependent clause can create a scope and a typed obligation:

```json
{
  "expandRole": "scope",
  "scopeType": "ModalScope",
  "acceptedTypes": ["Event", "Modality"]
}
```

The executor opens a child Scope, evaluates the semantic target recursively, resolves a Requirement to that target, closes the child Scope, and returns to its parent. Deeper calls resolve before callers. An incompatible target produces `REQUIREMENT_TYPE_MISMATCH`; an unresolved requirement cannot make a Scope `RESOLVED`. All scope identities are deterministic.

**Safety properties:** recursive semantic cycles and depth above 32 fail; outputs over 4,096 words are rejected; missing lexemes or unmatched complex objects are explicit errors; a flat role lookup cannot discard nested semantic roles or extra role members. Authored `valueTypes` add specificity to pattern selection. All new primitives are language-neutral and exercised by unit tests; the recovered reference pack uses them in **30 new persisted cases**, not the original lost 30-case corpus.

**Next gaps:** restore true complement-call mechanics and conditionals, author verified coordination/comparison and possession-trail surfaces, rebuild Sentence Lab and full phonological rules/provenance, and independently review all reference-language surface claims. Keep the legacy `examples/reference-slice` fixture out of language-completeness claims.
