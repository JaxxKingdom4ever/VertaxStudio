# Vertax 2 Design Specification

**Status:** Design approved in conversation; implementation planning pending review  
**Target path:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`  
**Product:** Vertax 2  
**Core idea:** A visual IDE and deterministic compiler for executable human-language grammars.

---

## 1. Product Definition

Vertax 2 is a node-based environment for defining, compiling, testing, and debugging human languages.

It is not primarily a translator, dictionary editor, or visual form for documenting grammar. Its core abstraction is:

> A language is an executable set of typed transformations from meaning to linguistic form.

Vertax treats a language grammar as a visual program. Users build that program with typed nodes and reusable node groups. A confirmed semantic representation enters the compiler, moves through grammar, morphology, phonology, and surface realization, and produces a deterministic output.

The visual editor is the authoring environment. The compiler runtime is the authority.

The long-term product identity is:

> **Vertax is an IDE for executable human languages.**

---

## 2. Design Goals

Vertax 2 must:

1. Represent grammatical systems without assuming English syntax.
2. Allow users to build novel grammatical behavior without modifying Vertax source code.
3. Keep linguistic facts separate from linguistic logic.
4. Make recursion, scope, deferred resolution, and structural dependencies first-class.
5. Make grammar failures inspectable rather than mysterious.
6. Compile deterministically once meaning has been established.
7. Preserve a complete provenance trace from semantic input to surface output.
8. Allow successful examples to become regression tests.
9. Scale from simple conlangs to unusually recursive and structurally atypical languages.
10. Keep the node interface approachable without weakening the engine underneath.

---

## 3. Non-Goals for Version 1.0

Vertax 1.0 will not require:

- perfect automatic parsing of arbitrary natural-language input;
- cloud accounts;
- multiplayer collaboration;
- a public grammar marketplace;
- a large AI assistant embedded into every workflow;
- full historical language simulation;
- automatic proto-language evolution;
- high-quality speech synthesis;
- hundreds of typological templates;
- arbitrary executable JavaScript inside normal projects.

These may be added later without changing the compiler model.

---

# Part I — System Architecture

## 4. Compilation Pipeline

Vertax uses explicit compiler stages:

```text
SOURCE
  ↓
Semantic Parse / Meaning Composer
  ↓
MeaningGraph
  ↓
Meaning Normalization
  ↓
Grammar
  ↓
Morphology
  ↓
Phonology
  ↓
Surface / Orthography
  ↓
OUTPUT
```

The canonical typed transition is conceptually:

```text
MeaningGraph
→ GrammarStructure
→ MorphSequence
→ PhonologicalForm
→ SurfaceForm
```

No stage should silently depend on representation details belonging to a later stage.

### 4.1 Stage separation

Examples:

- Grammar may decide that two semantic elements form a `BoundUnit`.
- Morphology may decide that PAST is a suffix.
- Phonology may alter that suffix according to environment.
- Surface may decide that morpheme boundaries are written with apostrophes.

Therefore, semantic binding must not directly mean “insert an apostrophe.”

---

## 5. Core Architectural Principle

Nodes transform **typed linguistic objects**, not arbitrary strings.

Raw string transformations are allowed only at explicitly surface-oriented layers.

This prevents the grammar graph from becoming dependent on source-language word order or orthographic accidents.

---

# Part II — MeaningGraph

## 6. MeaningGraph Purpose

MeaningGraph is Vertax’s language-neutral semantic representation.

It stores what is meant, not how any particular language expresses it.

For:

> The hunter gave the child a red book.

MeaningGraph should represent:

```text
EVENT: GIVE
├── agent → ENTITY: hunter
├── recipient → ENTITY: child
└── theme → ENTITY: book
              └── property → RED
```

It must not encode “subject,” “direct object,” “indirect object,” or English word order as the semantic truth.

---

## 7. Built-in Semantic Types

Vertax ships with a small extensible ontology:

- `Entity`
- `Group`
- `Event`
- `State`
- `Property`
- `Relation`
- `Quantity`
- `Proposition`
- `Unknown`
- `Reference`
- `Modality`
- `SemanticList`

Subtyping is supported.

Examples:

```text
Person <: Entity
Location <: Entity
PhysicalObject <: Entity

SpatialRelation <: Relation
TemporalRelation <: Relation

ActionEvent <: Event
ChangeOfState <: Event
```

Users may eventually define custom subtypes.

---

## 8. Semantic Roles

MeaningGraph edges use semantic roles rather than grammatical positions.

Built-in examples include:

- agent
- patient
- theme
- recipient
- experiencer
- stimulus
- source
- goal
- instrument
- location
- reference
- possessor
- possessed
- cause
- result

This list is extensible.

Vertax must not enforce a closed theory of thematic roles.

---

## 9. Semantic Features

Semantic objects can carry feature bundles.

Example:

```text
tense_relation → before_speech_time
aspect → continuous
polarity → positive
certainty → asserted
```

Important distinction:

> Semantic time is not grammatical tense.

A language may express past time with no tense morphology, or may grammatically mark tense even where another language uses an adverb.

---

## 10. Identity and Reference

Discourse entities receive stable identities.

Example:

```text
Entity #24
concept: HUNTER
```

References point to existing entities:

```text
Reference #31
target: Entity #24
```

Coreference is therefore a graph relationship, not a string-matching problem.

This supports pronouns, reflexivity, reciprocal reference, and group identity.

---

## 11. Group Identity

Groups are first-class semantic objects.

Example:

```text
Group #8
members:
  hunter #1
  hunter #2
  hunter #3
```

This allows a grammar to distinguish:

- actions involving members of the same group;
- actions involving a separate group of the same conceptual type.

A language may then realize those distinctions however it chooses.

---

## 12. Propositions

Propositions are semantic objects and may serve as participants in other semantic structures.

Example:

```text
BELIEVE
├── experiencer → I
└── content →
    PROPOSITION
      └── SURVIVE
          └── participant → BEAST
```

MeaningGraph does not assume a complementizer such as English “that.”

A target language may realize this content as:

- a subordinate clause;
- a complement call;
- an event noun;
- a participial structure;
- an evidential construction;
- another strategy.

---

## 13. Unknowns and Questions

Questions are represented with `Unknown` semantic objects.

Examples:

### Who?

```text
Unknown
expected_type: Person
role: agent
```

### What?

```text
Unknown
expected_type: Entity
role: theme
```

### Where?

```text
Unknown
expected_type: SpatialRelation | Location
```

### Why?

```text
Unknown
expected_type: LogicalRelation | Cause
```

### Yes/no question

```text
Unknown
expected_type: TruthValue
target: Proposition
```

Target languages decide how these unknowns are realized.

---

## 14. Ambiguity

Vertax must preserve ambiguity instead of silently resolving it.

Example:

> I saw the man with the telescope.

The semantic parser may produce:

```text
Ambiguity
├── interpretation A
└── interpretation B
```

The user can inspect and select the intended MeaningGraph.

A compiler must never pretend uncertain semantic parsing is deterministic grammar.

---

## 15. Provenance and Inference

Semantic links may be marked as:

- `Explicit`
- `Inferred`
- `Contextual`
- `Default`
- `UserSupplied`

Optional confidence metadata may accompany inferred relations.

Vertax should distinguish source meaning from pragmatic inference.

---

## 16. Idioms

Idioms are handled in semantic interpretation before target-language grammar.

Example:

> kick the bucket

may be mapped to:

```text
Event: DIE
participant → speaker-referenced person
```

while preserving source metadata:

```text
source_expression: "kick the bucket"
interpretation: idiomatic
```

Languages may define their own idiom-to-meaning mappings.

---

## 17. DiscourseGraph

MeaningGraphs exist inside a larger discourse context.

DiscourseGraph may track:

- known entities;
- active topic;
- recent referents;
- speaker;
- listener;
- time;
- location;
- established groups;
- definiteness;
- presuppositions;
- previous propositions.

Context supplies evidence, not magical certainty.

---

# Part III — Grammar Representation

## 18. GrammarStructure

Grammar rules output typed `GrammarStructure` objects rather than strings.

Possible structures include:

- `Clause`
- `Phrase`
- `OrderedGroup`
- `BoundUnit`
- `ArgumentFrame`
- `ListStructure`
- `DeferredStructure`
- `MorphCandidate`

This representation sits between MeaningGraph and Morphology.

---

## 19. Bindings

Bindings represent structured semantic or grammatical connections.

A binding conceptually contains:

```text
left
right
relation
strength
metadata
```

Possible relations include:

- semantic-bind
- modifier
- head-dependent
- coreference
- argument
- conjoined

Target-language grammar determines how a binding is realized.

---

## 20. Requirements

Requirements are first-class runtime objects.

A node may open a requirement such as:

```text
Requirement
type: complement
accepted_types:
  - SpatialRelation
  - Location
  - State
owner: PLACE
status: OPEN
```

Compatible structures may later resolve it.

This mechanism supports:

- complement calls;
- long-distance dependencies;
- deferred arguments;
- recursive possession;
- agreement dependencies;
- certain relative constructions;
- interrogative resolution;
- coordination.

---

## 21. Scopes

Scopes are first-class runtime containers.

A scope records:

```text
id
type
parent
children
bindings
requirements
features
local_values
status
```

Possible built-in or user-defined types include:

- Root
- Clause
- Phrase
- Complement
- Relative
- Conditional
- Coordination
- PossessionRecursion
- Custom

Scopes allow nested grammar to resolve in a predictable open → resolve → return model.

---

## 22. Lists and Trails

Vertax supports explicit list structures.

Core operations include:

- create;
- append;
- prepend;
- head;
- tail;
- reverse;
- length;
- map;
- reduce;
- push;
- pop.

These are required for grammatical systems involving:

- coordination tails;
- possession trails;
- ordered argument lists;
- recursive chains.

---

# Part IV — Node System

## 23. Node Philosophy

Vertax provides a small set of powerful linguistic primitives.

Higher-level grammar features are built from those primitives and may be packaged as reusable Node Groups.

Vertax should not hard-code every possible grammatical category.

---

## 24. Primitive Node Families

### 24.1 Meaning/Input

- Entity
- Event
- State
- Relation
- Property
- Quantity
- Proposition
- Modality
- Unknown / Question Target

### 24.2 Match

- Match Type
- Match Feature
- Has Role
- Has Feature
- Is Impersonal
- Pattern Match
- List Length Match
- Scope Match

### 24.3 Transform

- Replace
- Wrap
- Extract
- Promote
- Demote
- Move
- Copy
- Delete
- Insert
- Group
- Ungroup
- Bind
- Split
- Merge

### 24.4 Features

- Set Feature
- Read Feature
- Copy Feature
- Remove Feature
- Compare Feature
- Require Feature
- Default Feature

### 24.5 Ordering

- Order
- Priority Order
- Move Before
- Move After
- Place First
- Place Last
- Adjacent To
- Immediately Before
- Immediately After

### 24.6 Binding

- Bind
- Conjoin
- Associate
- Attach
- Head–Dependent Bind
- Semantic Unit

### 24.7 Lists

- Create List
- Append
- Prepend
- Head
- Tail
- Reverse
- Length
- For Each
- Reduce
- Pop
- Push

### 24.8 Scope

- Open Scope
- Close Scope
- Current Scope
- Parent Scope
- Root Scope
- Child Scope
- Return to Parent

### 24.9 Resolution

- Open Requirement
- Resolve Requirement
- Current Requirement
- Can Resolve?
- Require
- Return

### 24.10 Branching

- If
- Else
- Switch
- Choose
- Fallback
- Try

### 24.11 Lexicon

- Get Lexeme
- Get Related Lexeme
- Get Form
- Find By Concept
- Has Form?
- Read Valency

### 24.12 Morphology

- Root
- Affix
- Prefix
- Suffix
- Circumfix
- Zero Morph
- Select Allomorph
- Morph Order
- Fuse
- Reduplicate
- Mutation
- Agreement

### 24.13 Phonology

- Replace Phoneme
- Assimilate
- Delete
- Insert
- Metathesize
- Stress
- Syllabify
- Harmony
- Lenition
- Fortition
- Environment Match

### 24.14 Surface

- Spell
- Join
- Space
- Capitalize
- Punctuate
- Orthographic Rewrite
- Output

---

## 25. Node Groups

A Node Group packages an internal graph behind a typed interface.

A Node Group contains:

```text
inputs
outputs
parameters
internal_graph
tests
description
version
```

Node Groups are fundamental, not an advanced add-on.

Users should be able to build reusable grammar concepts such as:

- Complement Call
- Interrogative Search
- Recursive Possession
- Relational Verb
- Clause Resolver
- Comparison
- Evidentiality System

The outer graph should not care whether a node shipped with Vertax or was built by the user.

---

## 26. Node Complexity Levels

Vertax exposes three practical complexity levels using one engine:

### Simple linguistic nodes

Human-facing operations such as:

- Order Arguments
- Apply Tense
- Conjoin
- Build Relative Structure

### Advanced primitives

- Match
- Bind
- Resolve
- Map List
- Scope
- Requirement

### Custom Node Groups

User-defined high-level grammar components composed from primitives.

---

# Part V — Lexicon and Data

## 27. Lexicon

Vocabulary is stored separately from grammar logic.

A Lexeme contains:

```text
id
concept
lexical_class
forms
features
valency
related_lexemes
irregular_rules
metadata
```

Example:

```text
Concept: DIE
Class: verb
Valency:
  participant: Entity
Related:
  event_noun → DEATH
```

This supports lexical families without requiring automatic category conversion.

---

## 28. Valency

Valency is declarative data.

Example:

```text
GIVE
agent: Entity      required
recipient: Entity  required
theme: Entity      required
```

Example:

```text
PLACE
agent: Entity
theme: Entity
goal: Relation | Location | State
```

Grammar rules can inspect valency instead of hard-coding the meaning of each lexical verb.

---

## 29. Tables

Tables store recurring mappings and linguistic facts.

Examples:

```text
TENSE
present → Ø
past    → PAST
future  → FUTURE
```

```text
RELATION TYPE
movement → te-
space    → zo-
logic    → la-
time     → ni-
```

Rule:

> Tables store facts. Nodes store logic.

---

# Part VI — Morphology, Phonology, and Surface

## 30. Abstract Morphology

Grammar emits abstract morphs before surface forms.

Example:

```text
ROOT(EAT)
CONTINUOUS
PAST
```

Morphology resolves these into:

```text
es + eat + in
```

Surface may later realize boundaries as:

```text
es'eat'in
```

---

## 31. Morph Object

A Morph includes:

```text
meaning
position
form
features
realization_state
```

Zero morphology is first-class.

An unmarked category is a valid explicit realization.

---

## 32. PhonologicalForm

Phonology operates on structured sound sequences rather than plain strings.

The representation preserves:

- phonemes;
- morpheme boundaries;
- syllable boundaries;
- stress;
- word boundaries.

This allows environment-sensitive phonological rules.

---

## 33. SurfaceForm

SurfaceForm contains:

```text
graphemes
spacing
punctuation
capitalization
source_map
```

The source map associates final output spans with the semantic, grammatical, morphological, and node-level provenance that created them.

This powers hover-to-trace behavior.

---

# Part VII — Compiler Runtime

## 34. Deterministic Execution

Vertax compilation is deterministic after MeaningGraph confirmation.

The same:

- project state;
- MeaningGraph;
- compiler settings;

must produce the same output unless the language explicitly defines variants.

AI may assist semantic parsing or rule authoring, but must not decide grammar during deterministic compilation.

---

## 35. Execution Conditions

A node runs when:

1. required inputs exist;
2. input types are valid;
3. its conditions match;
4. its dependencies are resolved.

Canvas location does not determine execution order.

---

## 36. Object Lifecycle

Runtime objects may pass through states such as:

- Unprocessed
- Matched
- Transforming
- Waiting
- Resolved
- Emitted
- Failed

Waiting objects may depend on open Requirements.

---

## 37. Rule Model

A Rule is separate from a Node.

A Rule contains:

```text
matcher
graph
priority
scope
fallback
enabled
tests
```

Nodes define operations.

Rules define when graphs apply.

---

## 38. Rule Precedence

Rule selection uses:

1. specificity;
2. declared precedence;
3. fallback status.

Users may specify:

- Apply before…
- Apply after…
- Override…
- Fallback only…

If two equally valid rules remain ambiguous, compilation stops and reports the conflict.

Vertax must never silently guess.

---

## 39. Pure Nodes by Default

Nodes should be pure transformations whenever possible.

State-changing nodes must explicitly declare side effects such as:

- opening scope;
- closing scope;
- mutating discourse context;
- opening requirements.

The UI should visually distinguish stateful nodes.

---

## 40. Fixed-Point Execution

A compiler stage completes when no valid transformation remains.

It does not complete merely because a token has reached the visually rightmost node.

Conceptual loop:

```text
1. Load typed input
2. Validate
3. Enter scope
4. Find matching rules
5. Select deterministic winner
6. Apply transformation
7. Record provenance
8. Open/resolve requirements as necessary
9. Repeat until fixed point
10. Validate stage output
11. Pass to next stage
```

---

## 41. Recursion Safety

Vertax detects:

- identical state revisits;
- no-progress recursion;
- cyclic rule application;
- recursion depth overflow.

Example diagnostic:

```text
Recursion halted.

Relative Resolution processed the same structure
32 times without changing it.

Cycle:
Relative Resolution
→ Description Rule
→ Relative Resolution
```

The compiler must fail safely rather than freeze.

---

## 42. Immutable Trace

Every transformation creates a new trace state rather than destructively overwriting history.

Trace records:

```text
before
after
node
rule
scope
reason
step
```

Users can scrub backward and forward through compilation.

---

## 43. Compilation Modes

### Fast
Normal compilation with minimal tracing.

### Trace
Records all transformations.

### Strict
Refuses unresolved ambiguity, inferred reference, missing lexical forms, and unsafe fallback behavior.

### Exploratory
Future or optional 1.x feature. Returns all valid realizations instead of selecting one where the grammar intentionally permits multiple outputs.

---

# Part VIII — Vertax Studio

## 44. Main Editor

The center of Vertax Studio is the graph canvas.

Primary layout:

```text
┌─────────────────────────────────────────────────────────────────┐
│ VERTAX   Language: Example   Meaning > Grammar > Morph > Surface│
├──────────────┬──────────────────────────────────────┬────────────┤
│ PROJECT      │            NODE CANVAS               │ INSPECTOR  │
│              │                                      │            │
│ Grammar      │                                      │ selected   │
│ Lexicon      │                                      │ node       │
│ Tables       │                                      │ settings   │
│ Tests        │                                      │            │
├──────────────┴──────────────────────────────────────┴────────────┤
│ INPUT                                         ▶ COMPILE         │
│ OUTPUT                                        ◉ TRACE           │
└─────────────────────────────────────────────────────────────────┘
```

The graph receives most of the screen.

Panels should collapse or become contextual rather than permanently consuming workspace.

---

## 45. Project Navigation

Top-level workspaces:

1. Graph Studio
2. Lexicon
3. Data Tables
4. Sentence Lab
5. Tests
6. Project

Graph Studio includes stages:

- Meaning
- Grammar
- Morphology
- Phonology
- Surface

---

## 46. Graph Hierarchy

Node Groups open as nested graphs.

Breadcrumb example:

```text
Grammar
› Clause Realization
› Possession
› Recursive Possession
```

This prevents a real language from becoming one enormous graph.

Folders are organizational only and do not impose a typological theory.

---

## 47. Node Shelf

A searchable Node Shelf opens at the cursor.

Search supports:

- node names;
- concepts;
- user-created Node Groups;
- approximate intent.

Example search:

```text
"loop through possessors"
```

may surface:

- For Each
- Reverse List
- Tail
- Recursive Possession

---

## 48. Typed Ports

Ports declare:

```text
id
label
direction
accepted_type
cardinality
required
default
```

Cardinality options:

- ONE
- OPTIONAL
- MANY

Type should be communicated with more than color alone. Shape, label, iconography, and hover information should reinforce meaning.

---

## 49. Sentence Lab

Sentence Lab is the primary compile-and-debug environment.

Views:

- Source
- Meaning
- Final
- Gloss
- Structure
- Trace
- Errors

Users may compile from:

- typed source text;
- manually composed MeaningGraph;
- saved semantic test cases.

---

## 50. Meaning Composer

Meaning Composer allows semantic input through:

- Form view;
- Tree view;
- Graph view.

Form view supports basic structured authoring.

Graph view exposes the complete semantic model.

Automatic parsing is assistive, never authoritative.

---

## 51. Live Object Inspector

Clicking a wire or trace step reveals the object flowing through it.

Example progression:

```text
Event
→ Clause
→ MorphSequence
→ PhonologicalForm
→ SurfaceForm
```

The inspector shows relevant features, roles, scope, requirements, and provenance at each stage.

---

## 52. Breakpoints

Users may pause Trace at a node.

At a breakpoint, Vertax shows:

- current object;
- active scope stack;
- open requirements;
- local bindings;
- current feature bundle;
- execution history.

This acts as a grammar debugger.

---

## 53. Diagnostics

Diagnostics must be linguistic and actionable.

Example:

```text
Unresolved Complement Call

PLACE opened a requirement for a destination or resulting
relation, but the structure ended before a compatible value
was supplied.

Accepted:
SpatialRelation
Location
State
```

Diagnostics include:

- severity;
- code;
- message;
- object;
- node;
- scope;
- trace;
- suggested actions.

Severity levels:

- Info
- Warning
- Error
- Fatal

---

# Part IX — Testing

## 54. Tests as First-Class Language Assets

Successful examples can be saved directly as tests.

Example:

```text
Meaning:
COOK
agent = UNKNOWN(Person)
theme = FOOD
aspect = continuous

Expected:
person'vo duru esi'cook food
```

A test can start and end at any compiler stage.

---

## 55. Test Object

A Test includes:

```text
input_stage
input
expected_stage
expected_output
mode
assertions
```

Examples:

- MeaningGraph → Surface
- GrammarStructure → MorphSequence
- PhonologicalForm → Surface
- Source text → MeaningGraph

Parser tests and grammar tests should remain separable.

---

## 56. Regression Workflow

After grammar changes, Vertax reruns affected tests.

Example:

```text
✓ 184 passed
✕ 7 failed
```

Clicking a failed test opens the exact trace divergence.

Examples therefore act as both documentation and unit tests.

---

# Part X — Project Format

## 57. Human-Readable Project Structure

A Vertax project should be inspectable and version-control-friendly.

Conceptually:

```text
MyLanguage.vertax/
├── project.json
├── concepts/
├── lexicon/
├── graphs/
│   ├── grammar/
│   ├── morphology/
│   ├── phonology/
│   └── surface/
├── tables/
├── node-groups/
├── tests/
└── settings.json
```

The desktop UI may present this as one project.

---

## 58. Stable IDs

All durable references use stable IDs.

Names are editable labels.

Renaming:

```text
"Hunter" → "Tracker"
```

must not break graph references.

---

## 59. Logic vs Layout

Graph logic and node layout are stored separately.

Moving nodes on the canvas must not change compiler semantics.

No linguistic meaning may depend on:

- line color;
- curve shape;
- node position;
- canvas distance.

---

## 60. Project Manifest

The project manifest includes:

```text
id
name
version
schema_version
default_language
graphs
lexicons
features
concepts
tables
tests
settings
dependencies
```

`schema_version` allows Vertax project migration as the application evolves.

---

# Part XI — Version 1.0 Scope

## 61. Required for 1.0

### Core
- typed graph runtime;
- MeaningGraph;
- GrammarStructure;
- typed ports;
- Node Groups;
- Rules;
- Requirements;
- Scopes;
- lists and recursion;
- deterministic precedence;
- validation;
- trace provenance.

### Authoring
- Graph Studio;
- Node Shelf;
- hierarchical graphs;
- Inspector;
- Lexicon;
- Data Tables;
- Meaning Composer;
- Sentence Lab;
- Tests.

### Language realization
- Grammar;
- Morphology;
- basic but real Phonology;
- Surface / Orthography.

### Debugging
- Live Trace;
- object inspection;
- breakpoints;
- structured diagnostics;
- recursion protection;
- test runner.

### Persistence
- human-readable project format;
- stable IDs;
- schema versioning;
- import/export of Node Groups.

---

## 62. Deferred from 1.0

- full arbitrary-language semantic parsing;
- cloud sync;
- live collaboration;
- public sharing marketplace;
- broad AI automation;
- speech synthesis;
- historical evolution engine;
- large template ecosystem;
- public plugin marketplace;
- unrestricted scripted nodes.

---

# Part XII — Initial User Journey

## 63. Create a Language

User chooses:

### Blank Language
Minimal runtime and primitives only.

### Starter Language
Provides organizational scaffolding such as:

```text
Grammar
├── Clause
├── Noun Structure
└── Relations

Morphology
├── Inflection
└── Word Formation

Phonology
└── Sound Rules

Surface
├── Word Joining
└── Orthography
```

These are organizational defaults, not grammatical assumptions.

---

## 64. Build First Sentence

Example source:

> I see the dog.

MeaningGraph:

```text
SEE
├── agent → I
└── target → DOG
```

With no grammar, Vertax reports:

```text
No grammar rule can realize SEE.
```

The user opens Grammar and creates an argument-order rule.

Vertax gets farther, then reports missing lexical forms.

The user creates Lexemes.

Compilation succeeds.

The result can be saved as a test.

This workflow teaches Vertax through productive failure.

---

# Part XIII — Acceptance Test

## 65. Primary Acceptance Criterion

Vertax 1.0 succeeds if a structurally unusual language can be encoded without adding custom source-code exceptions to Vertax itself.

The current reference conlang should be representable using only the normal engine.

Its features include:

- past/future tense morphology;
- aspect prefixes;
- relational verbs;
- multiple copular relations;
- semantic conjoining;
- complement calls;
- nested structural resolution;
- conditional suffixing;
- impersonal conditional behavior;
- negation transfer behavior;
- recursive possession;
- possessive trails;
- interrogative search attachment;
- relational interrogatives;
- zero-marked imperatives;
- dynamic coordination verbs;
- coordination tails;
- scalar modality;
- comparison markers;
- attachment-sensitive superlatives;
- same-group and other-group reference;
- ditransitive ordering;
- relational deixis;
- semantic definiteness.

None of these may require a hard-coded “special conlang feature” inside Vertax.

They must emerge from:

- types;
- features;
- bindings;
- lists;
- scopes;
- requirements;
- rules;
- lexicon data;
- morphology;
- surface realization.

---

# Part XIV — Technical Direction

## 66. Recommended Application Stack

Preferred implementation direction:

- **React + TypeScript** for the application UI.
- **React Flow / xyflow** for the graph editor.
- **ELK** for optional graph auto-layout.
- **Tauri 2** for desktop packaging.
- Local project files as the primary persistence model.

The compiler core should be isolated from the UI so it can be tested independently and reused later by:

- CLI tools;
- automated test runners;
- server environments;
- external integrations.

---

## 67. Architectural Boundaries

Suggested major packages/modules:

```text
core-types
meaning
runtime
rules
grammar
morphology
phonology
surface
lexicon
project-model
validation
trace
test-runner
studio-ui
graph-editor
desktop-shell
```

The compiler core must not depend on React.

The UI consumes the compiler through explicit interfaces.

---

# Part XV — Design Principles to Preserve

## 68. Facts vs Logic

> Tables and lexicons store facts.  
> Nodes and rules store behavior.

---

## 69. Meaning Before Form

> MeaningGraph stores what is meant.  
> Grammar decides how the language expresses it.

---

## 70. Structure Before String

> Vertax manipulates typed linguistic structures until the Surface stage.

---

## 71. Explicit Ambiguity

> Vertax reports uncertainty rather than hiding it.

---

## 72. Deterministic Grammar

> AI may suggest meaning or authoring help.  
> Confirmed MeaningGraph compilation is deterministic.

---

## 73. Debuggable by Construction

Every output should be traceable back through:

```text
Surface
→ Phonology
→ Morphology
→ Grammar
→ Meaning
```

---

## 74. Extensible Without Source-Code Changes

A user should be able to invent a grammatical mechanism Vertax’s authors never predicted and implement it using nodes, rules, scopes, requirements, types, and Node Groups.

That is the defining architectural promise of Vertax 2.

---

# 75. Final Product Statement

Vertax 2 is a visual compiler and IDE for executable human-language grammars.

It gives language creators:

- a language-neutral semantic model;
- a typed node programming environment;
- a deterministic grammar runtime;
- reusable linguistic modules;
- lexical and table-driven data;
- recursive scope and requirement handling;
- morphology, phonology, and orthography pipelines;
- a semantic debugger;
- regression testing;
- human-readable project files.

The product is successful when a creator can move from:

> “I have an unusual grammatical idea.”

to:

> “I encoded it as a reusable, testable, executable language rule.”

without modifying Vertax itself.

