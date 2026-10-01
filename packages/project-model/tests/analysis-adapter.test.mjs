import test from 'node:test';
import assert from 'node:assert/strict';
import { toAnalyzerProject } from '../../../dist/packages/project-model/src/index.js';
const m={schema_version:2,id:'legacy',name:'Legacy',version:'1',default_language:'x',graphs:{},lexicons:[],features:[],concepts:[],tables:[],node_groups:[],tests:[],settings:'settings.json',layouts:[],dependencies:[]};
const pack={manifest:m,stageDocuments:[],concepts:{},features:{},lexemes:{},tables:{},nodeGroups:{},layouts:{},tests:{},settings:{}};
test('generation-only schema-2 project does not silently acquire analyzer',()=>{
 const a=toAnalyzerProject(pack);assert.equal(a.project,undefined);assert.equal(a.diagnostics[0].code,'NO_ANALYZER_CAPABILITY');
});
test('analyze capability without four reverse stages is diagnosed',()=>{
 const a=toAnalyzerProject({...pack,manifest:{...m,language:{tag:'z',display_name:'Test',autonym:'Test',direction:'ltr',capabilities:['analyze']}}});
 assert.equal(a.project,undefined);assert.equal(a.diagnostics.filter(x=>x.code==='MISSING_ANALYSIS_STAGE').length,4);
});
