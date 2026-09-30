import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildProjectTree,createStudioState} from '../../../dist/packages/studio-model/src/index.js';
import {referencePersistedProject} from '../../../dist/examples/reference-slice/persisted-project.js';
test('project tree exposes Sentence Lab and Tests as selectable Studio resources',()=>{
 const tree=buildProjectTree(createStudioState(referencePersistedProject));
 assert.ok(tree.some(item=>item.id==='resource:sentence-lab'));
 assert.ok(tree.some(item=>item.id==='resource:tests'));
});
test('Studio mounts real Sentence Lab, Meaning Composer, Trace debugger and test-saving modules',async()=>{
 const folder='apps/studio/src';
 for(const file of ['sentence-lab.ts','meaning-composer.ts','trace-debugger.ts','lab-tests.ts']){
  const source=await readFile(`${folder}/${file}`,'utf8');assert.ok(source.trim().length>300,`${file} must implement an actual workspace`);
 }
 const app=await readFile(`${folder}/app.ts`,'utf8');
 assert.match(app,/mountSentenceLab/);
 assert.match(app,/mode==='sentence'/);
 assert.match(app,/mode==='tests'/);
});
