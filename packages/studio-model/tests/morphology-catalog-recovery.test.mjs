import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {createStudioState,buildNodeCatalog,searchNodeCatalog} from '../../../dist/packages/studio-model/src/index.js';
import {referencePersistedProject} from '../../../dist/examples/reference-slice/persisted-project.js';
const r=new NodeRegistry();registerCorePrimitives(r);
const catalog=buildNodeCatalog(createStudioState(referencePersistedProject,r.listDefinitions()));
test('all recovered morphology nodes have discoverable labels and typed settings',()=>{
 const expected=[['morph.affix','Attach affix'],['morph.circumfix','Circumfix'],['morph.select-allomorph','Select allomorph'],['morph.order','Order morphs'],['morph.fuse','Fuse morphs'],['morph.reduplicate','Reduplicate'],['morph.mutate','Mutate morph'],['morph.agreement','Agreement']];
 for(const [id,label] of expected){
  assert.equal(catalog.find(x=>x.typeId===id)?.label,label);
  assert.equal(catalog.find(x=>x.typeId===id)?.category,'Morphology');
  assert.ok(r.get(id)?.authoring?.parameters?.length>0);
 }
 assert.equal(searchNodeCatalog(catalog,'allomorph')[0]?.typeId,'morph.select-allomorph');
 assert.equal(r.get('morph.select-allomorph').authoring.parameters.find(p=>p.id==='tableId')?.kind,'table');
 assert.equal(r.get('morph.select-allomorph').authoring.parameters.find(p=>p.id==='candidates')?.kind,'json');
 assert.equal(r.get('morph.agreement').authoring.parameters.find(p=>p.id==='features')?.kind,'json');
});
