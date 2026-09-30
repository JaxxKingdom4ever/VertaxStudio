import test from 'node:test';
import assert from 'node:assert/strict';
import {draggedNodePosition,finishNodeDrag,panViewport} from '../../../dist/apps/studio/src/graph-canvas.js';
import {createStudioState,createStudioHistory,applyStudioEdit,undoStudio,selectedGraphLayout,selectedGraphDocument} from '../../../dist/packages/studio-model/src/index.js';
import {referencePersistedProject} from '../../../dist/examples/reference-slice/persisted-project.js';

test('drag delta is normalized by zoom and does not accumulate between mousemove events',()=>{
  const start={x:240,y:150};
  assert.deepEqual(draggedNodePosition(start,90,50,2),{x:285,y:175});
  assert.deepEqual(draggedNodePosition(start,180,100,2),{x:330,y:200});
  assert.deepEqual(panViewport({x:1,y:2,zoom:2},18,-12),{x:19,y:-10,zoom:2});
});

test('completing drag selects node and records exactly one reversible layout edit',()=>{
  const original=createStudioState(referencePersistedProject);
  const first=selectedGraphDocument(original).graph.nodes[0];
  const from=selectedGraphLayout(original)?.nodes[first.id]??{x:0,y:0};
  const destination=draggedNodePosition(from,60,32,1.5);
  const moved=finishNodeDrag(original,first.id,destination);
  assert.equal(moved.selection.id,first.id);
  assert.deepEqual(selectedGraphLayout(moved).nodes[first.id].x,destination.x);
  assert.deepEqual(selectedGraphLayout(moved).nodes[first.id].y,destination.y);
  const originalHistory=createStudioHistory(original);
  const history=applyStudioEdit(originalHistory,()=>({state:moved,diagnostics:[]}));
  assert.equal(history.past.length,1);
  assert.deepEqual(undoStudio(history).present.project.layouts,original.project.layouts);
});
