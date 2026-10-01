import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveProjectPath, saveProject, loadProject } from '../../../dist/packages/project-model/src/index.js';

function minimalProject() {
  const graph = { id:'g1', nodes:[], edges:[], exposedInputs:[], exposedOutputs:[] };
  return {
    manifest: {
      schema_version:1, id:'project-1', name:'Example', version:'0.1.0', default_language:'example',
      graphs:{ Grammar:['graphs/grammar/g1.json'] }, lexicons:['lexicon/lexicon.json'], features:['features/features.json'], concepts:['concepts/concepts.json'],
      tables:['tables/tense.json'], node_groups:[], tests:[], settings:'settings.json', layouts:['layouts/g1.json'], dependencies:[],
    },
    concepts:{ PERSON:{id:'PERSON',label:'Person',semanticType:'Entity',metadata:{}} },
    features:{ aspect:{id:'aspect',label:'Aspect',allowedValues:['neutral'],defaultValue:'neutral',allowedOn:['Event'],inheritance:'copy'} },
    lexemes:{ 'lex-person':{id:'lex-person',conceptId:'PERSON',lexicalClass:'noun',forms:{citation:'person'},features:{values:{}},valency:[],relatedLexemes:{},irregularRuleIds:[],metadata:{}} },
    tables:{ tense:{id:'tense',label:'Tense',columns:['semantic'],rows:[{semantic:'present'}],metadata:{}} },
    stageDocuments:[{schema_version:1,stage:'Grammar',graph,rules:[]}],
    layouts:{ g1:{schema_version:1,graph_id:'g1',nodes:{}} },
    nodeGroups:{}, tests:{}, settings:{ theme:'dark' },
  };
}

test('resolveProjectPath rejects traversal and absolute paths', async () => {
  const root = '/tmp/vertax-root';
  assert.equal(resolveProjectPath(root, '../outside.json').diagnostics[0]?.code, 'UNSAFE_PROJECT_PATH');
  assert.equal(resolveProjectPath(root, '/absolute/path').diagnostics[0]?.code, 'UNSAFE_PROJECT_PATH');
  const safe = resolveProjectPath(root, 'graphs/grammar/g1.json');
  assert.deepEqual(safe.diagnostics, []);
  assert.equal(safe.path?.startsWith(root), true);
});

test('save writes canonical readable project and load reconstructs durable project', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'vertax-io-'));
  const root = join(parent, 'Example.vertax');
  try {
    const project = minimalProject();
    const saved = await saveProject(root, project);
    assert.equal(saved.success, true);
    assert.deepEqual(saved.diagnostics, []);
    assert.equal(typeof JSON.parse(await readFile(join(root,'project.json'),'utf8')).name, 'string');
    assert.equal(JSON.parse(await readFile(join(root,'graphs/grammar/g1.json'),'utf8')).graph.id, 'g1');
    assert.equal(JSON.parse(await readFile(join(root,'layouts/g1.json'),'utf8')).graph_id, 'g1');
    const loaded = await loadProject(root);
    assert.deepEqual(loaded.diagnostics, []);
    assert.equal(loaded.project?.manifest.id, project.manifest.id);
    assert.deepEqual(loaded.project?.concepts, project.concepts);
    assert.deepEqual(loaded.project?.stageDocuments, project.stageDocuments);
    assert.deepEqual(loaded.project?.layouts, project.layouts);
    assert.deepEqual(loaded.project?.settings, project.settings);
  } finally { await rm(parent,{recursive:true,force:true}); }
});

test('failed serialization leaves existing destination byte-for-byte unchanged', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'vertax-atomic-'));
  const root = join(parent, 'Example.vertax');
  try {
    await mkdir(root,{recursive:true});
    await writeFile(join(root,'marker.txt'),'ORIGINAL','utf8');
    const project = minimalProject();
    const circular = {}; circular.self = circular;
    project.settings = circular;
    const result = await saveProject(root, project);
    assert.equal(result.success, false);
    assert.equal(await readFile(join(root,'marker.txt'),'utf8'), 'ORIGINAL');
    const siblings = await readdir(parent);
    assert.equal(siblings.some(name => name.startsWith('Example.vertax.tmp-')), false);
  } finally { await rm(parent,{recursive:true,force:true}); }
});

test('load refuses structurally decoded project with invalid cross references', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'vertax-invalid-crossref-'));
  const root = join(parent, 'Invalid.vertax');
  try {
    const project = minimalProject();
    project.lexemes['lex-person'] = { ...project.lexemes['lex-person'], conceptId: 'MISSING-CONCEPT' };
    const saved = await saveProject(root, project);
    assert.equal(saved.success, true);
    const loaded = await loadProject(root);
    assert.equal(loaded.project, undefined);
    assert.equal(loaded.diagnostics.some(d => d.code === 'MISSING_CONCEPT_REFERENCE'), true);
  } finally { await rm(parent,{recursive:true,force:true}); }
});

test('load rejects resource symlink that escapes project root', async () => {
  const { symlink } = await import('node:fs/promises');
  const parent = await mkdtemp(join(tmpdir(), 'vertax-symlink-'));
  const root = join(parent, 'Symlink.vertax');
  const outside = join(parent, 'outside');
  try {
    const project = minimalProject();
    const saved = await saveProject(root, project);
    assert.equal(saved.success, true);
    await mkdir(outside,{recursive:true});
    await writeFile(join(outside,'concepts.json'),JSON.stringify(Object.values(project.concepts)),'utf8');
    await rm(join(root,'concepts'),{recursive:true,force:true});
    await symlink(outside,join(root,'concepts'),'dir');
    const loaded = await loadProject(root);
    assert.equal(loaded.project, undefined);
    assert.equal(loaded.diagnostics.some(d => d.code === 'UNSAFE_PROJECT_PATH'), true);
  } finally { await rm(parent,{recursive:true,force:true}); }
});
