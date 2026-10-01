import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceSliceProject } from '../../../dist/examples/reference-slice/project.js';

test('reference lexeme exposes durable features valency relationships and metadata', () => {
  const cook = referenceSliceProject.resources.lexemes['lex-cook'];
  assert.ok(cook);
  assert.deepEqual(cook.features, { values: {} });
  assert.deepEqual(cook.valency, [
    { role: 'agent', acceptedTypes: ['Entity'], required: true, cardinality: 'ONE' },
    { role: 'theme', acceptedTypes: ['Entity'], required: false, cardinality: 'ONE' },
  ]);
  assert.deepEqual(cook.relatedLexemes, { event_noun: ['lex-cooking'] });
  assert.deepEqual(cook.irregularRuleIds, []);
  assert.deepEqual(cook.metadata, {});
});

test('project resource tables preserve structured columns and rows', () => {
  const tense = referenceSliceProject.resources.tables['tense'];
  assert.ok(tense);
  assert.equal(tense.label, 'Tense');
  assert.deepEqual(tense.columns, ['semantic', 'morph']);
  assert.deepEqual(tense.rows, [
    { semantic: 'present', morph: 'ZERO' },
    { semantic: 'past', morph: 'PAST' },
  ]);
});

import {
  decodeConcepts,
  decodeFeatures,
  decodeLexicon,
  decodeDataTable,
  buildProjectResources,
} from '../../../dist/packages/project-model/src/index.js';

const conceptDocs = [
  { id: 'PERSON', label: 'Person', semanticType: 'Entity', metadata: {} },
  { id: 'COOK', label: 'Cook', semanticType: 'Event', metadata: {} },
  { id: 'COOKING', label: 'Cooking', semanticType: 'Event', metadata: {} },
];
const featureDocs = [
  { id: 'aspect', label: 'Aspect', allowedValues: ['neutral', 'continuous'], defaultValue: 'neutral', allowedOn: ['Event'], inheritance: 'copy' },
];
const lexemeDocs = [
  { id: 'lex-cook', conceptId: 'COOK', lexicalClass: 'verb', forms: { citation: 'cook' }, features: { values: {} }, valency: [], relatedLexemes: { event_noun: ['lex-cooking'] }, irregularRuleIds: [], metadata: {} },
  { id: 'lex-cooking', conceptId: 'COOKING', lexicalClass: 'event-noun', forms: { citation: 'cooking' }, features: { values: {} }, valency: [], relatedLexemes: {}, irregularRuleIds: [], metadata: {} },
];

test('resource decoders accept valid concepts features lexicon and data tables', () => {
  assert.deepEqual(decodeConcepts(conceptDocs).diagnostics, []);
  assert.deepEqual(decodeFeatures(featureDocs).diagnostics, []);
  assert.deepEqual(decodeLexicon(lexemeDocs).diagnostics, []);
  assert.deepEqual(decodeDataTable({ id: 'tense', label: 'Tense', columns: ['semantic'], rows: [{ semantic: 'past' }], metadata: {} }).diagnostics, []);
});

test('resource construction diagnoses missing concept reference', () => {
  const documents = { concepts: conceptDocs, features: featureDocs, lexemes: [{ ...lexemeDocs[0], conceptId: 'MISSING', relatedLexemes: {} }], tables: [] };
  const result = buildProjectResources(documents);
  assert.equal(result.resources, undefined);
  assert.equal(result.diagnostics.some(d => d.code === 'MISSING_CONCEPT_REFERENCE'), true);
});

test('resource construction diagnoses missing related lexeme reference', () => {
  const documents = { concepts: conceptDocs, features: featureDocs, lexemes: [{ ...lexemeDocs[0], relatedLexemes: { event_noun: ['missing-lexeme'] } }], tables: [] };
  const result = buildProjectResources(documents);
  assert.equal(result.resources, undefined);
  assert.equal(result.diagnostics.some(d => d.code === 'MISSING_LEXEME_REFERENCE'), true);
});

test('feature decoder rejects default value outside allowed values', () => {
  const result = decodeFeatures([{ ...featureDocs[0], defaultValue: 'perfect' }]);
  assert.equal(result.value, undefined);
  assert.equal(result.diagnostics[0]?.code, 'INVALID_FEATURE_DEFAULT');
});

test('valid resources derive concept to lexeme index exactly once', () => {
  const result = buildProjectResources({ concepts: conceptDocs, features: featureDocs, lexemes: lexemeDocs, tables: [] });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.resources?.conceptToLexemeIds.COOK, ['lex-cook']);
  assert.deepEqual(result.resources?.conceptToLexemeIds.COOKING, ['lex-cooking']);
});
