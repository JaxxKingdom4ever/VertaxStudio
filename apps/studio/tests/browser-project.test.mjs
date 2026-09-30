import test from 'node:test';import assert from 'node:assert/strict';
import { exportBrowserProject, importBrowserProject } from '../../../dist/apps/studio/src/browser-project.js';
import { createStudioState } from '../../../dist/packages/studio-model/src/index.js';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';
test('browser project export/import preserves executable graphs and layouts',()=>{const state=createStudioState(referencePersistedProject);const text=exportBrowserProject(state);const result=importBrowserProject(text);assert.deepEqual(result.diagnostics,[]);assert.deepEqual(result.state.project.stageDocuments,state.project.stageDocuments);assert.deepEqual(result.state.project.layouts,state.project.layouts)});

import { readFile } from 'node:fs/promises';
test('browser-facing Studio modules do not depend on Node project IO barrel',async()=>{
  const browser=await readFile(new URL('../../../dist/apps/studio/src/browser-project.js',import.meta.url),'utf8');
  const validation=await readFile(new URL('../../../dist/packages/studio-model/src/validation.js',import.meta.url),'utf8');
  const studioIndex=await readFile(new URL('../../../dist/packages/studio-model/src/index.js',import.meta.url),'utf8');
  assert.doesNotMatch(browser,/project-model\/src\/index\.js|node:/);
  assert.doesNotMatch(validation,/project-model\/src\/index\.js|node:/);
  assert.doesNotMatch(studioIndex,/node-persistence/);
});
