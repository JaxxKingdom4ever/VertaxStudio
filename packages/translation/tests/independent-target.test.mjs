import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,toAnalyzerProject,toCompilerProject} from '../../../dist/packages/project-model/src/index.js';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {translateSurface} from '../../../dist/packages/translation/src/index.js';
const registry=new NodeRegistry();registerCorePrimitives(registry);
test('independent persisted target may realize shared English meanings in a completely different word order',async()=>{
 const source=await loadProject('language-packs/english.vertax');
 const target=await loadProject('examples/synthetic-target.vertax');
 assert.ok(source.project);assert.ok(target.project,JSON.stringify(target.diagnostics));
 const analyzer=toAnalyzerProject(source.project);const generator=toCompilerProject(target.project);
 assert.ok(analyzer.project);assert.ok(generator.project,JSON.stringify(generator.diagnostics));
 const translated=translateSurface({sourceLoaded:source.project,targetLoaded:target.project,
  sourceProject:analyzer.project,targetProject:generator.project,sourceRegistry:registry,targetRegistry:registry,
  text:'The person cooks the food.',options:{mode:'trace',maxStepsPerStage:200}});
 assert.equal(translated.success,true,JSON.stringify(translated.diagnostics));
 assert.equal(translated.surface,'fu pa ku');
 assert.equal(translated.candidates[0].meaning.objects.event.conceptId,'sem:event.cook');
 const meaning=translated.candidates[0].meaning;
 assert.equal(meaning.objects[meaning.objects.event.roles.theme[0]].conceptId,'sem:entity.food');
});
