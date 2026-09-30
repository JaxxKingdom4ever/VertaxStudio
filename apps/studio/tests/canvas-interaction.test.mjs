import test from 'node:test';import assert from 'node:assert/strict';
import { panViewport } from '../../../dist/apps/studio/src/graph-canvas.js';
test('panning preserves zoom and translates viewport',()=>{assert.deepEqual(panViewport({x:5,y:10,zoom:2},20,-5),{x:25,y:5,zoom:2})});
