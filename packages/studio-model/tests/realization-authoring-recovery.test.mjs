import test from 'node:test';import assert from 'node:assert/strict';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {createStudioState,buildNodeCatalog,searchNodeCatalog} from '../../../dist/packages/studio-model/src/index.js';
import {referencePersistedProject} from '../../../dist/examples/reference-slice/persisted-project.js';
const registry=new NodeRegistry();registerCorePrimitives(registry);
const state=createStudioState(referencePersistedProject,registry.listDefinitions());
test('phonological and surface nodes present human labels, categories and typed parameters',()=>{
 const catalog=buildNodeCatalog(state);
 for(const [type,label] of [['phon.replace','Replace phoneme'],['phon.assimilate','Assimilate'],['phon.harmony','Vowel harmony'],['surface.spell','Spell phonemes'],['surface.punctuate','Punctuate']]){
   const entry=catalog.find(e=>e.typeId===type);
   assert.equal(entry?.label,label);
   assert.ok(['Phonology','Surface'].includes(entry?.category));
 }
 assert.equal(searchNodeCatalog(catalog,'vowel harmony')[0]?.typeId,'phon.harmony');
 const spell=registry.get('surface.spell');
 assert.equal(spell.authoring.parameters.find(p=>p.id==='tableId')?.kind,'table');
 assert.equal(registry.get('phon.replace').authoring.parameters.find(p=>p.id==='replaceWith')?.kind,'text');
 assert.equal(registry.get('phon.environment-match').outputs[0].required,false);
});
