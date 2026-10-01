import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioState, selectWorkspace } from '../../../dist/packages/studio-model/src/index.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';

test('reference project opens in Graph Studio on the first Grammar graph', () => {
  const state = createStudioState(referencePersistedProject);
  assert.equal(state.workspace, 'GraphStudio');
  assert.equal(state.graphSelection?.stage, 'Grammar');
  assert.equal(state.graphSelection?.graphId, 'ref-grammar-graph');
  assert.deepEqual(state.graphSelection?.nodeGroupPath, []);
  assert.deepEqual(state.selection, { kind: 'none' });
  assert.equal(state.leftPanelOpen, true);
  assert.equal(state.rightPanelOpen, true);
  assert.equal(state.dirty, false);
});

test('workspace navigation does not mutate persisted project documents', () => {
  const state = createStudioState(referencePersistedProject);
  const before = JSON.stringify(state.project);
  const next = selectWorkspace(state, 'Lexicon');
  assert.equal(next.workspace, 'Lexicon');
  assert.equal(JSON.stringify(next.project), before);
  assert.equal(next.project, state.project);
  assert.equal(next.dirty, false);
});

import { buildProjectTree, selectGraph, selectedGraphDocument, selectedGraphLayout } from '../../../dist/packages/studio-model/src/index.js';

test('project tree exposes language stages and resource sections', () => {
  const state = createStudioState(referencePersistedProject);
  const labels = buildProjectTree(state).map(item => item.label);
  for (const label of ['Grammar','Morphology','Phonology','Surface','Lexicon','Tables','Tests']) assert.ok(labels.includes(label), label);
  const grammar = buildProjectTree(state).find(item => item.label === 'Grammar');
  assert.equal(grammar?.children[0]?.targetId, 'ref-grammar-graph');
});

test('selectGraph updates navigation and clears element selection', () => {
  const state = { ...createStudioState(referencePersistedProject), selection:{kind:'node',id:'old-node'} };
  const next = selectGraph(state, 'Morphology', 'ref-morph-graph');
  assert.equal(next.graphSelection?.stage, 'Morphology');
  assert.equal(next.graphSelection?.graphId, 'ref-morph-graph');
  assert.deepEqual(next.selection,{kind:'none'});
  assert.equal(selectedGraphDocument(next)?.graph.id,'ref-morph-graph');
  assert.equal(selectedGraphLayout(next)?.graph_id,'ref-morph-graph');
});
