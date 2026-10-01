import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticFingerprint} from '../../../dist/packages/compiler/src/index.js';
import {loadProject,toAnalyzerProject} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {analyzeSurface} from '../../../dist/packages/compiler/src/index.js';
test('candidate semantic identity excludes textual provenance and source token offsets',()=>{
 const graph=note=>({roots:['e'],objects:{e:{id:'e',type:'Event',conceptId:'sem:event.cook',roles:{},features:{values:{}},provenance:[{kind:'Explicit',sourceId:`source:${note.length}`,note}]}}});
 assert.equal(semanticFingerprint(graph('Cooks')),semanticFingerprint(graph('cooks')));
});
test('English analyzer does not leak source lexeme form keys into language-neutral MeaningGraph features',async()=>{
 const pack=(await loadProject('language-packs/english.vertax')).project;const reg=new NodeRegistry();registerCorePrimitives(reg);
 const out=analyzeSurface(toAnalyzerProject(pack).project,reg,'The people cook the food.',{mode:'fast',maxStepsPerStage:200});
 assert.equal(out.success,true);
 for(const object of Object.values(out.candidates[0].meaning.objects))assert.equal('formKey' in object.features.values,false);
});
