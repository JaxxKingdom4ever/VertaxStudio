import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, toCompilerProject } from '../../../dist/packages/project-model/src/index.js';

const emptyGraph = id => ({ id, nodes:[], edges:[], exposedInputs:[], exposedOutputs:[] });
const stage = (name,id,rules=[]) => ({ schema_version:1, stage:name, graph:emptyGraph(id), rules });
function validProject(){
  return {
    manifest:{schema_version:1,id:'project-1',name:'Valid',version:'0.1.0',default_language:'valid',graphs:{Grammar:[],Morphology:[],Surface:[]},lexicons:[],features:[],concepts:[],tables:[],node_groups:[],tests:[],settings:'settings.json',layouts:[],dependencies:[]},
    concepts:{ PERSON:{id:'PERSON',label:'Person',metadata:{}} }, features:{},
    lexemes:{ 'lex-person':{id:'lex-person',conceptId:'PERSON',lexicalClass:'noun',forms:{citation:'person'},features:{values:{}},valency:[],relatedLexemes:{},irregularRuleIds:[],metadata:{}} },
    tables:{},
    stageDocuments:[stage('Grammar','g-grammar'),stage('Morphology','g-morph'),stage('Surface','g-surface')],
    layouts:{},nodeGroups:{},tests:{},settings:{}
  };
}

test('duplicate stable id across different collections is diagnosed', () => {
  const project=validProject();
  project.lexemes.PERSON={...project.lexemes['lex-person'],id:'PERSON'};
  const ds=validateProject(project);
  assert.equal(ds.some(d=>d.code==='DUPLICATE_STABLE_ID'),true);
});

test('rule referencing missing graph is diagnosed', () => {
  const project=validProject();
  project.stageDocuments[0]={...project.stageDocuments[0],rules:[{id:'r1',stage:'Grammar',matcher:{kind:'type',type:'Event'},graphId:'missing-graph',priority:0,fallback:false}]};
  const ds=validateProject(project);
  assert.equal(ds.some(d=>d.code==='MISSING_RULE_GRAPH_REFERENCE'),true);
});

test('valid loaded project converts to compiler project with matching stages and resources', () => {
  const project=validProject();
  const result=toCompilerProject(project);
  assert.deepEqual(result.diagnostics,[]);
  assert.ok(result.project);
  assert.equal(result.project.grammar.graphs['g-grammar'].id,'g-grammar');
  assert.equal(result.project.morphology.graphs['g-morph'].id,'g-morph');
  assert.equal(result.project.surface.graphs['g-surface'].id,'g-surface');
  assert.deepEqual(result.project.resources.conceptToLexemeIds.PERSON,['lex-person']);
});

test('compiler adapter refuses projects missing a required executable stage', () => {
  const project=validProject();
  project.stageDocuments=project.stageDocuments.filter(x=>x.stage!=='Surface');
  const result=toCompilerProject(project);
  assert.equal(result.project,undefined);
  assert.equal(result.diagnostics.some(d=>d.code==='MISSING_REQUIRED_STAGE'),true);
});
