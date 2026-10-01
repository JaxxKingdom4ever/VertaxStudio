import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  decodeProjectManifest,
  decodeStageGraphDocument,
  decodeGraphLayoutDocument,
} from '../../../dist/packages/project-model/src/index.js';

const manifest = {
  schema_version: 1,
  id: 'project-1', name: 'Example', version: '0.1.0', default_language: 'example',
  graphs: { Grammar: ['graphs/grammar/g1.json'] },
  lexicons: ['lexicon/lexicon.json'], features: ['features/features.json'], concepts: ['concepts/concepts.json'],
  tables: [], node_groups: [], tests: [], settings: 'settings.json', layouts: ['layouts/g1.json'], dependencies: [],
};
const graph = {
  id: 'g1',
  nodes: [{ id: 'n1', typeId: 'test.identity', params: {} }],
  edges: [],
  exposedInputs: [{ graphPortId: 'value', nodeId: 'n1', nodePortId: 'value' }],
  exposedOutputs: [{ graphPortId: 'value', nodeId: 'n1', nodePortId: 'value' }],
};
const rule = { id: 'r1', stage: 'Grammar', matcher: { kind: 'type', type: 'Event' }, graphId: 'g1', priority: 1, fallback: false };

test('valid v1 manifest with snake_case keys decodes', () => {
  const result = decodeProjectManifest(manifest);
  assert.equal(CURRENT_PROJECT_SCHEMA_VERSION, 2);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.value, manifest);
});

test('missing manifest schema version is diagnosed', () => {
  const { schema_version, ...raw } = manifest;
  const result = decodeProjectManifest(raw);
  assert.equal(result.value, undefined);
  assert.equal(result.diagnostics[0]?.code, 'INVALID_PROJECT_MANIFEST');
});

test('stage graph preserves graph node type ids and rules', () => {
  const raw = { schema_version: 1, stage: 'Grammar', graph, rules: [rule] };
  const result = decodeStageGraphDocument(raw);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.value?.graph.nodes[0]?.typeId, 'test.identity');
  assert.equal(result.value?.rules[0]?.graphId, 'g1');
});

test('layout changes never alter stage graph document value', () => {
  const stageRaw = { schema_version: 1, stage: 'Grammar', graph, rules: [rule] };
  const before = decodeStageGraphDocument(stageRaw).value;
  const layout = decodeGraphLayoutDocument({ schema_version: 1, graph_id: 'g1', nodes: { n1: { x: 20, y: 40 } } });
  assert.deepEqual(layout.diagnostics, []);
  const moved = decodeGraphLayoutDocument({ schema_version: 1, graph_id: 'g1', nodes: { n1: { x: 900, y: -12 } } });
  assert.deepEqual(moved.diagnostics, []);
  const after = decodeStageGraphDocument(stageRaw).value;
  assert.deepEqual(after, before);
});
