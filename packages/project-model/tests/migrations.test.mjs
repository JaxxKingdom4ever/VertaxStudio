import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MigrationRegistry,
  createDefaultMigrationRegistry,
  migrateManifest,
} from '../../../dist/packages/project-model/src/index.js';

const v0 = {
  schema_version:0, id:'p1', name:'Old', version:'0.0.1', default_language:'old',
  graphs:{Grammar:[]}, lexicons:[], features:[], concepts:[], tables:[], tests:[], settings:'settings.json'
};

test('schema zero migrates deterministically to schema two defaults', () => {
  const first = migrateManifest(v0, createDefaultMigrationRegistry());
  const second = migrateManifest(v0, createDefaultMigrationRegistry());
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(first.manifest, second.manifest);
  assert.equal(first.manifest?.schema_version, 2);
  assert.deepEqual(first.manifest?.node_groups, []);
  assert.deepEqual(first.manifest?.layouts, []);
  assert.deepEqual(first.manifest?.dependencies, []);
  assert.equal(first.manifest?.id, 'p1');
});

test('schema one retains generation fields when migrated to schema two', () => {
  const v1 = { ...v0, schema_version:1, node_groups:[], layouts:[], dependencies:[] };
  const result = migrateManifest(v1, createDefaultMigrationRegistry());
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.manifest, { ...v1, schema_version: 2 });
});

test('future schema is rejected before migration', () => {
  const result = migrateManifest({ ...v0, schema_version:3 }, createDefaultMigrationRegistry());
  assert.equal(result.manifest, undefined);
  assert.equal(result.diagnostics[0]?.code, 'UNSUPPORTED_PROJECT_SCHEMA');
});

test('missing migration path is diagnosed', () => {
  const result = migrateManifest(v0, new MigrationRegistry());
  assert.equal(result.manifest, undefined);
  assert.equal(result.diagnostics[0]?.code, 'PROJECT_MIGRATION_PATH_MISSING');
});
