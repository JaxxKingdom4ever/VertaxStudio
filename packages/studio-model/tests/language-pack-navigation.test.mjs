import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../../../dist/packages/project-model/src/index.js';
import { buildProjectTree, createStudioState, selectGraph } from '../../../dist/packages/studio-model/src/index.js';
test('language-pack reverse analysis graphs are discoverable and navigable in Graph Studio',async()=>{
 const loaded=await loadProject('language-packs/english.vertax');assert.ok(loaded.project);
 const state=createStudioState(loaded.project);const tree=buildProjectTree(state);
 const section=tree.find(x=>x.stage==='GrammarAnalysis');assert.ok(section);
 assert.equal(section.children.length,1);
 const chosen=selectGraph(state,'GrammarAnalysis',section.children[0].targetId);
 assert.equal(chosen.graphSelection.stage,'GrammarAnalysis');
});
