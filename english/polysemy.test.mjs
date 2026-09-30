import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject,toAnalyzerProject,toCompilerProject } from '../../dist/packages/project-model/src/index.js';
import { analyzeSurface } from '../../dist/packages/compiler/src/index.js';
import { NodeRegistry } from '../../dist/packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../dist/packages/primitives/src/index.js';
import { translateSurface } from '../../dist/packages/translation/src/index.js';

let loaded;
const opts={mode:'fast',maxStepsPerStage:500};
const registry=new NodeRegistry();registerCorePrimitives(registry);
async function pack(){loaded??=(await loadProject('language-packs/english.vertax')).project;return loaded;}

test('English bank has two genuine lexical senses with distinct MeaningGraph concepts',async()=>{
  const project=await pack(); const analyzer=toAnalyzerProject(project);
  assert.ok(analyzer.project,JSON.stringify(analyzer.diagnostics));
  const result=analyzeSurface(analyzer.project,registry,'The person saw the bank.',opts);
  assert.equal(result.success,true,JSON.stringify(result.diagnostics));
  assert.equal(result.candidates.length,2);
  const senses=result.candidates.map(({meaning})=>meaning.objects[meaning.objects.event.roles.theme[0]].conceptId).sort();
  assert.deepEqual(senses,['sem:entity.bank.financial','sem:entity.bank.river']);
  for(const {meaning} of result.candidates){
    assert.equal(meaning.objects.event.conceptId,'sem:event.see');
    assert.equal(meaning.objects[meaning.objects.event.roles.agent[0]].conceptId,'sem:entity.person');
  }
});

test('English polysemy requires explicit meaning selection in translation',async()=>{
  const source=await pack();const analyzer=toAnalyzerProject(source);const generator=toCompilerProject(source);
  assert.ok(analyzer.project);assert.ok(generator.project);
  const result=translateSurface({sourceProject:analyzer.project,sourceRegistry:registry,targetProject:generator.project,targetRegistry:registry,sourceLoaded:source,targetLoaded:source,text:'The person saw the bank.',options:opts});
  assert.equal(result.success,false);
  assert.equal(result.needsSelection,true);
  assert.equal(result.candidates.length,2);
  assert.equal(result.surface,undefined);
});

test('the bundled English corpus includes a persisted ambiguity case for lexical senses',async()=>{
  const project=await pack();
  const entry=project.tests['test:en:polysemy:bank'];
  assert.ok(entry,'polysemous English analysis must be included in pack acceptance, not only unit tests');
  assert.equal(entry.input.text,'The person saw the bank.');
  assert.equal(entry.expected_output.candidateCount,2);
});
