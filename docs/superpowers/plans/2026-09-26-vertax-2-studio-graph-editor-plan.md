# Vertax 2 Studio Graph Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Vertax Studio: a polished browser-based IDE shell that opens a persisted `.vertax` project, navigates its grammar graphs, visually edits typed nodes and edges, edits node parameters, searches and inserts primitives/Node Groups, maintains graph hierarchy, validates edits, supports undo/redo, and saves logic/layout back through the existing project model.

**Architecture:** Add an `@vertax/studio-model` package containing renderer-independent editor state and commands, plus an `apps/studio` browser application that renders the model with dependency-free TypeScript, DOM, CSS, and SVG. The editor directly manipulates existing `StageGraphDocument`, `GraphLayoutDocument`, and `NodeGroupDocument` shapes; graph logic and canvas layout remain separate at all times. Browser rendering is behind a narrow view adapter so a future React/xyflow renderer can replace the DOM/SVG implementation without changing editor commands, persistence, or compiler/project APIs.

**Tech Stack:** TypeScript, browser DOM/SVG/CSS, Node.js HTTP server for local development, npm workspaces, Node's built-in test runner. No new runtime dependencies in this environment.

**Spec:** `docs/superpowers/specs/2026-09-26-vertax-2-design.md`

## Global Constraints

- The graph canvas is the primary workspace; permanent side panels must not consume more space than necessary and must be collapsible/contextual.
- Studio edits the existing persisted graph/project contracts; it must not invent a second executable graph model.
- Graph logic and graph layout remain separate: dragging, panning, zooming, and resizing may not change executable graph documents.
- No linguistic meaning may depend on canvas position, line shape, color, or rendering order.
- Typed ports must communicate type with label/shape/icon treatment, not color alone.
- Connections that violate port direction, accepted types, or cardinality must be refused before they mutate the graph.
- Node array order and canvas position must never become execution order.
- Node Groups are first-class editor catalog entries and may be opened as nested graphs.
- Project folders/navigation are organizational only; they do not impose grammar categories beyond persisted stages.
- The Node Shelf must support name/type/keyword search and user-created Node Groups.
- Editor commands are immutable and undoable; undo/redo must restore both graph logic and layout correctly.
- Saving must go through the existing project-model APIs and validation boundary; Studio must not bypass safe project persistence.
- The existing compiler output `person'vo duru esi'cook food` must remain unchanged when only layout is edited.
- Sentence Lab, Meaning Composer, live execution trace, wire-value inspection, and breakpoints remain Phase 4; Phase 3 may show a compact validation/status footer but must not fake those debugger features.

## Review Focus

1. **A user drags a node and saves:** Task 3 must prove only `GraphLayoutDocument` changes and the executable `StageGraphDocument` remains byte-equivalent after canonical serialization.
2. **A user connects incompatible typed ports:** Task 4 must prove `connectPorts` returns `PORT_TYPE_MISMATCH` and leaves the graph unchanged.
3. **A ONE-cardinality input already has an incoming edge:** Task 4 must prove a second connection is rejected with `PORT_CARDINALITY_EXCEEDED` rather than silently replacing the first edge.
4. **A custom Node Group references a node type unknown to the built-in registry:** Task 5 must prove it still appears in the Node Shelf from project metadata and can be inserted as a Node Group instance descriptor without modifying core runtime code.
5. **A save is attempted while editor state contains invalid graph references:** Task 8 must prove save is blocked, diagnostics are surfaced, and the existing on-disk project is left unchanged.

---

## File Structure Locked by This Plan

```text
packages/
├── runtime/
│   └── src/
│       └── node-registry.ts            # add read-only definition enumeration for Studio
└── studio-model/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── model.ts                  # StudioState, selection, workspace/navigation types
    │   ├── project-session.ts        # LoadedVertaxProject -> editable StudioState
    │   ├── commands.ts               # immutable edit command dispatcher
    │   ├── graph-edit.ts             # add/remove/move/connect/disconnect operations
    │   ├── port-compatibility.ts     # typed connection validation
    │   ├── catalog.ts                # built-in primitive + Node Group catalog
    │   ├── search.ts                 # Node Shelf search/ranking
    │   ├── history.ts                # undo/redo snapshots/commands
    │   ├── hierarchy.ts              # breadcrumbs + nested Node Group navigation
    │   ├── validation.ts             # editor-local diagnostics before persistence
    │   ├── node-persistence.ts       # Node-only save bridge; never imported by browser index
    │   └── index.ts
    └── tests/
        ├── session.test.mjs
        ├── graph-edit.test.mjs
        ├── ports.test.mjs
        ├── catalog-search.test.mjs
        ├── history.test.mjs
        ├── hierarchy.test.mjs
        └── save.test.mjs
apps/
└── studio/
    ├── package.json
    ├── tsconfig.json
    ├── public/
    │   ├── index.html
    │   └── studio.css
    ├── src/
    │   ├── main.ts                   # application bootstrap
    │   ├── app.ts                    # top-level render/update loop
    │   ├── project-tree.ts           # left project navigation
    │   ├── graph-canvas.ts           # SVG nodes/edges/pan/zoom/drag
    │   ├── node-view.ts              # node + typed port rendering
    │   ├── node-shelf.ts             # searchable insertion palette
    │   ├── inspector.ts              # contextual right inspector
    │   ├── breadcrumbs.ts            # graph hierarchy navigation
    │   ├── toolbar.ts                # stage/workspace controls + undo/redo/save
    │   ├── status-bar.ts             # validation/save status
    │   └── browser-project.ts        # browser-facing project import/export bridge
    ├── tests/
    │   ├── html-smoke.test.mjs
    │   └── browser-project.test.mjs
    └── server.mjs                    # dependency-free local HTTP server
examples/
└── reference-slice/
    └── studio-project.ts             # browser-loadable reference project fixture
```

---

### Task 1: Studio Session Model and Application Shell

**Files:**
- Create: `packages/studio-model/package.json`
- Create: `packages/studio-model/tsconfig.json`
- Create: `packages/studio-model/src/model.ts`
- Create: `packages/studio-model/src/project-session.ts`
- Create: `packages/studio-model/src/index.ts`
- Create: `packages/studio-model/tests/session.test.mjs`
- Create: `apps/studio/package.json`
- Create: `apps/studio/tsconfig.json`
- Create: `apps/studio/public/index.html`
- Create: `apps/studio/public/studio.css`
- Create: `apps/studio/src/main.ts`
- Create: `apps/studio/src/app.ts`
- Create: `apps/studio/build.mjs`
- Create: `apps/studio/server.mjs`
- Modify: root `package.json`

**Interfaces:**
- Consumes: `LoadedVertaxProject`, `StageGraphDocument`, `GraphLayoutDocument`, `CompilerStage`.
- Produces:
  - `type StudioWorkspace = "GraphStudio" | "Lexicon" | "DataTables" | "SentenceLab" | "Tests" | "Project"`
  - `interface GraphSelection { readonly stage: CompilerStage; readonly graphId: StableId; readonly nodeGroupPath: readonly StableId[] }`
  - `interface StudioSelection { readonly kind: "none" | "node" | "edge"; readonly id?: StableId }`
  - `interface StudioState { readonly project: LoadedVertaxProject; readonly workspace: StudioWorkspace; readonly graphSelection?: GraphSelection; readonly selection: StudioSelection; readonly leftPanelOpen: boolean; readonly rightPanelOpen: boolean; readonly dirty: boolean }`
  - `function createStudioState(project: LoadedVertaxProject): StudioState`
  - `function selectWorkspace(state: StudioState, workspace: StudioWorkspace): StudioState`
  - root script `npm run studio` serving the compiled Studio at a local HTTP address.
  - `apps/studio/build.mjs` copies `public/index.html` and `public/studio.css` into `dist/apps/studio/public/` after TypeScript compilation.

- [ ] **Step 1: Write failing Studio-session tests**

Assert a loaded reference project creates a Studio state with:

```text
workspace = GraphStudio
selected stage = Grammar
selection = none
leftPanelOpen = true
rightPanelOpen = true
dirty = false
```

and `selectWorkspace` changes only workspace/navigation state, not project documents.

- [ ] **Step 2: Run the session test and verify RED**

Run:

```bash
npm run build && node --test packages/studio-model/tests/session.test.mjs
```

Expected: FAIL because `@vertax/studio-model` does not exist.

- [ ] **Step 3: Implement the renderer-independent session model**

`createStudioState` selects the first Grammar graph when available, otherwise the first persisted stage graph, otherwise leaves `graphSelection` undefined.

- [ ] **Step 4: Build the static Studio shell**

The HTML/CSS shell must contain:

```text
Top toolbar
Left Project panel
Central Graph Canvas
Right Inspector
Bottom status strip
```

Use a dark, restrained IDE visual language with high-contrast typed-port shapes, compact chrome, rounded but not playful panels, and the canvas receiving the majority of the viewport.

- [ ] **Step 5: Add dependency-free local serving**

`apps/studio/server.mjs` serves `dist/apps/studio/public` plus compiled module assets without directory traversal.

- [ ] **Step 6: Run session tests, full suite, and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/studio-model apps/studio package.json
git commit -m "feat: scaffold Vertax Studio shell"
```

---

### Task 2: Project Tree, Stage Navigation, and Graph Selection

**Files:**
- Modify: `packages/studio-model/src/model.ts`
- Modify: `packages/studio-model/src/project-session.ts`
- Create: `apps/studio/src/project-tree.ts`
- Create: `apps/studio/src/toolbar.ts`
- Expand: `packages/studio-model/tests/session.test.mjs`

**Interfaces:**
- Consumes: `StudioState`, loaded stage documents, project resources.
- Produces:
  - `interface ProjectTreeItem { readonly id: string; readonly label: string; readonly kind: "section" | "graph" | "resource"; readonly stage?: CompilerStage; readonly targetId?: StableId; readonly children: readonly ProjectTreeItem[] }`
  - `function buildProjectTree(state: StudioState): readonly ProjectTreeItem[]`
  - `function selectGraph(state: StudioState, stage: CompilerStage, graphId: StableId): StudioState`
  - `function selectedGraphDocument(state: StudioState): StageGraphDocument | undefined`
  - `function selectedGraphLayout(state: StudioState): GraphLayoutDocument | undefined`

- [ ] **Step 1: Write failing navigation tests**

Assert `buildProjectTree` exposes at least:

```text
Grammar
Morphology
Phonology
Surface
Lexicon
Tables
Tests
```

when the corresponding project assets exist, and selecting a graph updates `graphSelection` while clearing selected node/edge state.

- [ ] **Step 2: Verify RED**

Run the session test file and confirm the new navigation assertions fail.

- [ ] **Step 3: Implement project-tree and graph-selection helpers**

Tree sections are navigation only; no persisted folder/category is invented.

- [ ] **Step 4: Render project tree and stage controls**

Graph entries select the persisted graph. Resource sections may show counts/placeholders in this phase but do not yet implement full Lexicon/Table editors.

- [ ] **Step 5: Verify GREEN and full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/studio-model apps/studio/src/project-tree.ts apps/studio/src/toolbar.ts
git commit -m "feat: navigate Vertax project graphs"
```

---

### Task 3: SVG Graph Canvas, Selection, Dragging, Pan, and Zoom

**Files:**
- Create: `packages/studio-model/src/graph-edit.ts`
- Modify: `packages/studio-model/src/index.ts`
- Create: `packages/studio-model/tests/graph-edit.test.mjs`
- Create: `apps/studio/src/graph-canvas.ts`
- Create: `apps/studio/src/node-view.ts`
- Modify: `apps/studio/src/app.ts`

**Interfaces:**
- Consumes: selected `StageGraphDocument` + `GraphLayoutDocument`.
- Produces:
  - `function selectNode(state: StudioState, nodeId: StableId): StudioState`
  - `function selectEdge(state: StudioState, edgeKey: string): StudioState`
  - `function moveNode(state: StudioState, nodeId: StableId, x: number, y: number): StudioState`
  - `function setViewport(state: StudioState, viewport: ViewportLayout): StudioState`
  - `function ensureNodeLayout(state: StudioState, nodeId: StableId): StudioState`

- [ ] **Step 1: Write failing graph-edit tests**

Assert:

- `moveNode` changes only the selected graph's layout coordinates;
- the selected `StageGraphDocument` remains deeply equal before/after a move;
- canonical serialized graph logic is unchanged after node movement;
- selection changes do not mark the project dirty;
- layout movement does mark the project dirty.

- [ ] **Step 2: Verify RED**

Run `packages/studio-model/tests/graph-edit.test.mjs` and confirm failure.

- [ ] **Step 3: Implement immutable selection/layout edit operations**

Missing layouts receive deterministic initial positions on a simple grid; this initial layout remains layout-only data.

- [ ] **Step 4: Render the SVG graph canvas**

Requirements:

- SVG or SVG-backed central canvas;
- nodes positioned from `GraphLayoutDocument`;
- edges rendered independently of array order;
- click node/edge/background selection;
- pointer-drag nodes;
- canvas pan;
- wheel zoom clamped to a usable range;
- selected node/edge visually distinct;
- node dragging must never mutate `GraphNode.params` or graph arrays.

- [ ] **Step 5: Verify GREEN/full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/studio-model apps/studio/src/graph-canvas.ts apps/studio/src/node-view.ts apps/studio/src/app.ts
git commit -m "feat: render and navigate Studio graph canvas"
```

---

### Task 4: Typed Port Rendering and Safe Edge Editing

**Files:**
- Modify: `packages/runtime/src/node-registry.ts`
- Expand: `packages/runtime/tests/graph-executor.test.mjs`
- Create: `packages/studio-model/src/port-compatibility.ts`
- Expand: `packages/studio-model/src/graph-edit.ts`
- Create: `packages/studio-model/tests/ports.test.mjs`
- Modify: `apps/studio/src/node-view.ts`
- Modify: `apps/studio/src/graph-canvas.ts`

**Interfaces:**
- Consumes: `NodeDefinition`, `NodeGroupDocument`, `GraphDefinition`.
- Produces:
  - `interface PortDescriptor { readonly nodeId: StableId; readonly portId: string; readonly direction: "input" | "output"; readonly acceptedTypes: readonly string[]; readonly cardinality: "ONE" | "OPTIONAL" | "MANY"; readonly required: boolean; readonly source: "primitive" | "node-group" | "unknown" }`
  - `function resolveNodePorts(state: StudioState, nodeId: StableId): readonly PortDescriptor[]`
  - `function checkPortConnection(state: StudioState, source: PortEndpoint, target: PortEndpoint): readonly Diagnostic[]`
  - `function connectPorts(state: StudioState, source: PortEndpoint, target: PortEndpoint): EditResult`
  - `NodeRegistry.listDefinitions(): readonly NodeDefinition[]` returning definitions in registration order without exposing the internal Map.
  - `function disconnectEdge(state: StudioState, edgeKey: string): EditResult`

- [ ] **Step 1: Write failing registry-enumeration and port-compatibility tests**

Cover:

```text
NodeRegistry.listDefinitions() returns registered primitive definitions without mutation access
output -> compatible input = allowed
input -> input = PORT_DIRECTION_MISMATCH
Entity -> Morph input = PORT_TYPE_MISMATCH
second incoming edge to ONE input = PORT_CARDINALITY_EXCEEDED
exact duplicate edge = DUPLICATE_GRAPH_EDGE
```

Every rejected operation must preserve graph logic exactly.

- [ ] **Step 2: Verify RED**

Run the port test and confirm the new behavior is absent.

- [ ] **Step 3: Implement read-only registry enumeration, port resolution, and compatibility**

Primitive ports are resolved from `NodeRegistry.listDefinitions()` / `get()` metadata exposed to the Studio session. Node Group ports come from `NodeGroupDocument`. Unknown node types render as unknown/diagnostic nodes and cannot create new typed connections until their ports are known.

- [ ] **Step 4: Add interactive edge creation/deletion**

UI requirements:

- visible input/output port sockets;
- socket shape differs by direction/cardinality;
- text tooltip/label exposes accepted types;
- drag from output port to input port to connect;
- incompatible hover shows refusal state;
- selected edge can be deleted;
- port meaning is never conveyed by color alone.

- [ ] **Step 5: Verify GREEN/full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/studio-model apps/studio/src/node-view.ts apps/studio/src/graph-canvas.ts
git commit -m "feat: edit typed graph connections"
```

---

### Task 5: Node Catalog and Searchable Node Shelf

**Files:**
- Create: `packages/studio-model/src/catalog.ts`
- Create: `packages/studio-model/src/search.ts`
- Create: `packages/studio-model/tests/catalog-search.test.mjs`
- Create: `apps/studio/src/node-shelf.ts`
- Modify: `apps/studio/src/app.ts`

**Interfaces:**
- Consumes: registered primitive node definitions and project `NodeGroupDocument`s.
- Produces:
  - `interface NodeCatalogEntry { readonly id: string; readonly label: string; readonly typeId: string; readonly source: "primitive" | "node-group"; readonly keywords: readonly string[]; readonly description?: string; readonly groupId?: StableId }`
  - `function buildNodeCatalog(state: StudioState): readonly NodeCatalogEntry[]`
  - `function searchNodeCatalog(entries: readonly NodeCatalogEntry[], query: string): readonly NodeCatalogEntry[]`
  - `function nodeGroupTypeId(groupId: StableId): string` returning exactly `node-group:<groupId>`
  - `function parseNodeGroupTypeId(typeId: string): StableId | undefined`
  - `function addCatalogNode(state: StudioState, entry: NodeCatalogEntry, position: {x:number;y:number}): EditResult`

- [ ] **Step 1: Write failing catalog/search tests**

Assert:

- primitive nodes appear by type ID/name keywords;
- a project custom Node Group appears without runtime core changes;
- its inserted `GraphNode.typeId` is exactly `node-group:<stable-id>` and round-trips through `parseNodeGroupTypeId`;
- query `join` finds surface join before unrelated entries;
- query `group:<name>` can match a Node Group name;
- adding a catalog entry produces a new stable node ID and layout position.

- [ ] **Step 2: Verify RED**

Run the catalog-search test and confirm failure.

- [ ] **Step 3: Implement catalog construction, ranking, and node insertion**

Search order for this phase:

1. exact label/type match;
2. prefix match;
3. token/keyword contains;
4. Node Group name contains.

No AI/fuzzy embedding service is required in Phase 3. Node Group instances use the durable `node-group:<stable-id>` `GraphNode.typeId` convention; the Studio resolves their ports and nested graph from project `NodeGroupDocument` metadata.

- [ ] **Step 4: Render the Node Shelf**

Requirements:

- `Space` opens at/near the canvas cursor;
- typing filters immediately;
- Arrow keys navigate;
- Enter inserts;
- Escape closes;
- shelf shows source (`Primitive` / `Node Group`) and compact port summary;
- empty search has category sections instead of a huge flat list.

- [ ] **Step 5: Verify GREEN/full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/studio-model apps/studio/src/node-shelf.ts apps/studio/src/app.ts
git commit -m "feat: add searchable Studio node shelf"
```

---

### Task 6: Inspector, Node Parameter Editing, and Delete Operations

**Files:**
- Expand: `packages/studio-model/src/graph-edit.ts`
- Create: `apps/studio/src/inspector.ts`
- Expand: `packages/studio-model/tests/graph-edit.test.mjs`

**Interfaces:**
- Produces:
  - `function updateNodeParams(state: StudioState, nodeId: StableId, params: Readonly<Record<string, unknown>>): EditResult`
  - `function removeNode(state: StudioState, nodeId: StableId): EditResult`
  - `function removeSelected(state: StudioState): EditResult`
  - `function selectedInspectorModel(state: StudioState): InspectorModel`

`removeNode` must remove all incident graph edges and that node's layout entry atomically.

- [ ] **Step 1: Write failing inspector/edit tests**

Assert:

- changing node params modifies only the selected `GraphNode.params`;
- removing a node removes its incident edges and layout record;
- removing an edge leaves both endpoint nodes/layouts intact;
- selecting nothing yields project/graph summary inspector data rather than stale node data.

- [ ] **Step 2: Verify RED**

Run graph-edit tests.

- [ ] **Step 3: Implement immutable parameter/delete commands**

Unknown JSON parameter values remain editable through a structured JSON field in this phase; known parameter metadata may render specialized string/number/boolean controls.

- [ ] **Step 4: Render contextual Inspector**

Inspector modes:

```text
No selection -> graph summary + diagnostics
Node -> type, ID, params, ports
Edge -> endpoints + delete action
```

The right panel may collapse and must not obscure canvas interaction.

- [ ] **Step 5: Verify GREEN/full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/studio-model apps/studio/src/inspector.ts
git commit -m "feat: inspect and edit Studio graph elements"
```

---

### Task 7: Node Group Hierarchy and Breadcrumb Navigation

**Files:**
- Create: `packages/studio-model/src/hierarchy.ts`
- Create: `packages/studio-model/tests/hierarchy.test.mjs`
- Create: `apps/studio/src/breadcrumbs.ts`
- Modify: `apps/studio/src/app.ts`

**Interfaces:**
- Consumes: `NodeGroupDocument.internal_graph`, `GraphSelection.nodeGroupPath`.
- Produces:
  - `interface BreadcrumbItem { readonly id: string; readonly label: string; readonly depth: number }`
  - `function enterNodeGroup(state: StudioState, groupId: StableId): StudioState`
  - `function leaveNodeGroup(state: StudioState): StudioState`
  - `function navigateToBreadcrumb(state: StudioState, depth: number): StudioState`
  - `function buildBreadcrumbs(state: StudioState): readonly BreadcrumbItem[]`
  - `function activeGraphDefinition(state: StudioState): GraphDefinition | undefined`

- [ ] **Step 1: Write failing hierarchy tests**

Assert entering a Node Group:

- appends its ID to `nodeGroupPath`;
- exposes its `internal_graph` as active graph;
- does not replace or mutate the parent graph;
- breadcrumb back-navigation restores the exact parent graph selection.

Also assert an invalid group ID leaves state unchanged with `MISSING_NODE_GROUP_REFERENCE` diagnostic through the edit result path.

- [ ] **Step 2: Verify RED**

Run hierarchy tests.

- [ ] **Step 3: Implement hierarchy traversal**

Node Groups may nest recursively; traversal uses stable group IDs, not display names.

- [ ] **Step 4: Render breadcrumbs and double-click-to-enter behavior**

Example UI:

```text
Grammar › Clause Realization › Recursive Possession
```

Node Group nodes are visually distinguishable from primitive nodes without implying different execution semantics.

- [ ] **Step 5: Verify GREEN/full suite**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/studio-model apps/studio/src/breadcrumbs.ts apps/studio/src/app.ts
git commit -m "feat: navigate nested Node Group graphs"
```

---

### Task 8: Undo/Redo, Validation, Save, and Studio Acceptance Slice

**Files:**
- Create: `packages/studio-model/src/history.ts`
- Create: `packages/studio-model/src/validation.ts`
- Expand: `packages/studio-model/src/project-session.ts`
- Create: `packages/studio-model/src/node-persistence.ts`
- Create: `packages/studio-model/tests/history.test.mjs`
- Create: `packages/studio-model/tests/save.test.mjs`
- Create: `apps/studio/src/status-bar.ts`
- Create: `apps/studio/src/browser-project.ts`
- Create: `apps/studio/tests/html-smoke.test.mjs`
- Create: `apps/studio/tests/browser-project.test.mjs`
- Create: `apps/studio/build.mjs`
- Create: `examples/reference-slice/studio-project.ts`
- Modify: `apps/studio/src/toolbar.ts`
- Modify: `apps/studio/src/app.ts`
- Modify: root `package.json`

**Interfaces:**
- Produces:
  - `interface StudioHistory { readonly past: readonly StudioSnapshot[]; readonly present: StudioState; readonly future: readonly StudioSnapshot[] }`
  - `function createStudioHistory(state: StudioState): StudioHistory`
  - `function applyStudioEdit(history: StudioHistory, edit: (state: StudioState) => EditResult): StudioHistory`
  - `function undoStudio(history: StudioHistory): StudioHistory`
  - `function redoStudio(history: StudioHistory): StudioHistory`
  - `function validateStudioState(state: StudioState): readonly Diagnostic[]`
  - `async function saveStudioProject(state: StudioState, projectPath: string): Promise<SaveStudioResult>` from `node-persistence.ts`; this Node-only module is not re-exported by the browser-safe `@vertax/studio-model` index.
  - `function exportBrowserProject(state: StudioState): string`

- [ ] **Step 1: Write failing history tests**

Assert:

- move node → undo restores exact prior layout;
- add edge → undo removes edge → redo restores same edge;
- selecting a node does not create a history entry;
- after undo, a new edit clears redo history.

- [ ] **Step 2: Write failing save/validation tests**

Assert:

- editor-invalid graph references block save;
- blocked save leaves the existing on-disk project unchanged;
- valid save writes current logic/layout through project-model APIs;
- moving only node coordinates, saving, reloading, and compiling the reference MeaningGraph still outputs exactly `person'vo duru esi'cook food`.

- [ ] **Step 3: Verify RED**

Run the history/save tests and confirm failure.

- [ ] **Step 4: Implement history, Studio validation, and save bridge**

History stores logical snapshots/commands, not DOM/SVG state. `node-persistence.ts` first runs editor-local validation then existing `validateProject`, then uses the existing atomic project save boundary. Browser-safe Studio modules must never import `project-model/io.ts` or Node filesystem APIs.

- [ ] **Step 5: Add browser project bridge and Studio status UI**

Because a normal browser cannot write arbitrary directories without user-mediated filesystem APIs, Phase 3 supports:

- built-in reference project loading;
- JSON project export/import payload for browser use;
- local Node server integration for development save/reload.

Native desktop folder dialogs remain Phase 7/Tauri work.

- [ ] **Step 6: Add Studio smoke/acceptance tests**

Assert `public/index.html` exposes the expected Studio mount surface and the browser export/import round-trip preserves graph/layout documents.

- [ ] **Step 7: Add root Studio scripts**

Required scripts:

```text
npm run studio
npm run studio:build
```

`studio:build` produces a runnable static Studio bundle/assets inside `dist/apps/studio/` using the repository's existing TypeScript compiler and copied static files, with no network dependency.

- [ ] **Step 8: Run final Phase 3 verification**

Run:

```bash
npm test
npm run typecheck
npm run studio:build
npm run demo
```

Expected:

- all tests pass;
- typecheck passes;
- Studio static assets build successfully;
- demo output remains exactly `person'vo duru esi'cook food`.

- [ ] **Step 9: Commit**

```bash
git add packages/studio-model apps/studio examples/reference-slice/studio-project.ts package.json
git commit -m "feat: complete Vertax Studio graph editor slice"
```

---

## Phase 3 Acceptance Criteria

Phase 3 is complete when a user can launch Vertax Studio and, using the persisted reference project:

1. navigate Grammar/Morphology/Surface graphs from the project panel;
2. see nodes, typed ports, and edges on a pannable/zoomable graph canvas;
3. drag nodes without altering executable graph logic;
4. select and inspect nodes/edges;
5. create only type-compatible edges;
6. search primitives and custom Node Groups through the Node Shelf;
7. insert and delete nodes/edges;
8. enter nested Node Group graphs and navigate back via breadcrumbs;
9. edit node parameters;
10. undo/redo structural and layout edits;
11. see actionable project/editor diagnostics;
12. save/export valid edits through the existing persistence boundary;
13. reload a layout-only edit and still compile the reference meaning to exactly:

```text
person'vo duru esi'cook food
```

Phase 3 intentionally does **not** claim Sentence Lab/debugger completion. The bottom strip/status area is only a bridge to Phase 4, where Meaning Composer, compile views, live trace, object inspection, and breakpoints will be implemented.
