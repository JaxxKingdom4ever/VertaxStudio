import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const distRoot=resolve(fileURLToPath(new URL('../../../dist',import.meta.url)));
const entry=resolve(distRoot,'apps/studio/src/main.js');

// Traverses actual emitted browser modules, including re-exports. A Node-only
// module reachable from the browser entrypoint will break Studio at load time.
test('Studio browser entrypoint never imports Node built-ins or filesystem project IO',async()=>{
 const queue=[entry],seen=new Set(),invalid=[];
 while(queue.length){
  const file=queue.pop();if(seen.has(file))continue;seen.add(file);
  const contents=await readFile(file,'utf8');
  const paths=[...contents.matchAll(/\b(?:import|export)\s+(?:(?:[\s\S]*?)\s+from\s+)?['"]([^'"\n]+)['"]/g)].map(match=>match[1]);
  for(const target of paths){
   if(target.startsWith('node:')){invalid.push(`${relative(distRoot,file)} -> ${target}`);continue;}
   if(target.startsWith('.'))queue.push(resolve(dirname(file),target));
  }
 }
 assert.deepEqual(invalid,[],'Node builtin imports must not be reachable from browser modules');
 assert.ok(seen.size>30,'Test must traverse the real Studio module graph');
});
