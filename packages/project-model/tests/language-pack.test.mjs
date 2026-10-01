import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeProjectManifest, migrateManifest, createDefaultMigrationRegistry, validateSharedSemantics } from '../../../dist/packages/project-model/src/index.js';
import { compilerValueType } from '../../../dist/packages/core-types/src/index.js';
const old = {schema_version:1,id:'old',name:'Old',version:'1',default_language:'q',graphs:{Grammar:[]}, lexicons:[],features:[],concepts:[],tables:[],node_groups:[],tests:[],settings:'settings.json',layouts:[],dependencies:[]};
test('schema-1 generation projects migrate to v2 without claiming analysis capability',()=>{
 const r = migrateManifest(old,createDefaultMigrationRegistry());
 assert.deepEqual(r.diagnostics,[]);
 assert.equal(r.manifest.schema_version,2);
 assert.equal(r.manifest.language,undefined);
 assert.deepEqual(r.manifest.graphs,{Grammar:[]});
});
test('schema-2 manifest roundtrips language capabilities',()=>{
 const pack={...old,schema_version:2,language:{tag:'en',display_name:'English',autonym:'English',direction:'ltr',capabilities:['generate','analyze']}};
 assert.deepEqual(decodeProjectManifest(pack).value?.language,pack.language);
 assert.equal(decodeProjectManifest({...pack,language:{...pack.language,capabilities:['telepathy']}}).value,undefined);
});
test('shared semantic definitions compare types, never cosmetic labels',()=>{
 const a={"sem:book":{id:'sem:book',label:'Book',semanticType:'Entity',metadata:{}}};
 const b={"sem:book":{id:'sem:book',label:'Libro',semanticType:'Entity',metadata:{}}};
 assert.deepEqual(validateSharedSemantics(a,b),[]);
 assert.equal(validateSharedSemantics(a,{"sem:book":{...b['sem:book'],semanticType:'Event'}})[0].code,'SHARED_CONCEPT_MISMATCH');
});
test('reverse analysis values have stable port types',()=>{
 assert.equal(compilerValueType({id:'s',valueType:'SourceText',text:'hello'}),'SourceText');
 assert.equal(compilerValueType({id:'m',valueType:'SemanticGraphValue',graph:{objects:{},roots:[]}}),'SemanticGraphValue');
});
