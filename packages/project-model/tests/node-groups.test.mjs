import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeNodeGroupDocument,
  parseNodeGroupDocument,
  serializeNodeGroupDocument,
  decodePersistedTestDocument,
} from '../../../dist/packages/project-model/src/index.js';

const graph = {
  id: 'inner-g',
  nodes: [{ id: 'n1', typeId: 'grammar.bind', params: {} }],
  edges: [], exposedInputs: [], exposedOutputs: [],
};
const input = { id: 'value', direction: 'input', acceptedTypes: ['Entity'], cardinality: 'ONE', required: true };
const output = { id: 'result', direction: 'output', acceptedTypes: ['BoundUnit'], cardinality: 'ONE', required: true };
const group = {
  schema_version: 1,
  id: 'ng-bind', name: 'Bind Entity', version: '1.0.0', description: 'Example',
  inputs: [input], outputs: [output],
  parameters: [{ id: 'separator', label: 'Separator', valueType: 'string', required: false, defaultValue: "'" }],
  internal_graph: graph,
  test_ids: ['test-bind'],
};

test('node group round trips through portable json without layout data', () => {
  const decoded = decodeNodeGroupDocument(group);
  assert.deepEqual(decoded.diagnostics, []);
  const text = serializeNodeGroupDocument(decoded.value);
  assert.equal(text.includes('"x"'), false);
  const parsed = parseNodeGroupDocument(text);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(parsed.value, group);
});

test('node group rejects malformed port direction and cardinality', () => {
  const badDirection = decodeNodeGroupDocument({ ...group, inputs: [{ ...input, direction: 'sideways' }] });
  assert.equal(badDirection.diagnostics[0]?.code, 'INVALID_NODE_GROUP');
  const badCardinality = decodeNodeGroupDocument({ ...group, outputs: [{ ...output, cardinality: 'LOTS' }] });
  assert.equal(badCardinality.diagnostics[0]?.code, 'INVALID_NODE_GROUP');
});

test('persisted test document decodes compiler stages and assertions', () => {
  const raw = {
    schema_version: 1, id: 'test-bind', name: 'binds', input_stage: 'Meaning', input: { id: 'x' },
    expected_stage: 'Surface', expected_output: "x'vo", mode: 'trace', assertions: [{ path: 'surface', equals: "x'vo" }],
  };
  const result = decodePersistedTestDocument(raw);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.value, raw);
});
