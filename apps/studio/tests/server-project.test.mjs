import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { referencePersistedProject } from '../../../dist/examples/reference-slice/persisted-project.js';

function startServer(port,projectPath){
  const child=spawn(process.execPath,['apps/studio/server.mjs'],{cwd:new URL('../../..',import.meta.url),env:{...process.env,PORT:String(port),VERTAX_STUDIO_PROJECT:projectPath},stdio:['ignore','pipe','pipe']});
  return new Promise((resolve,reject)=>{let output='';const onData=chunk=>{output+=chunk.toString();if(output.includes('Vertax Studio:'))resolve(child)};child.stdout.on('data',onData);child.stderr.on('data',chunk=>{output+=chunk.toString()});child.on('exit',code=>reject(new Error(`server exited ${code}: ${output}`)));setTimeout(()=>reject(new Error(`server start timeout: ${output}`)),3000).unref()});
}

test('dev server saves and reloads browser project through real .vertax persistence',async()=>{
  const parent=await mkdtemp(join(tmpdir(),'vertax-studio-server-'));const projectPath=join(parent,'Saved.vertax');const port=43000+(process.pid%1000);let child;
  try{
    child=await startServer(port,projectPath);const base=`http://127.0.0.1:${port}`;const payload={format:'vertax-browser-project',version:1,project:referencePersistedProject};
    const saved=await fetch(`${base}/api/project`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});assert.equal(saved.status,200);const saveBody=await saved.json();assert.equal(saveBody.success,true);assert.match(await readFile(join(projectPath,'project.json'),'utf8'),/Reference Slice/);
    const loaded=await fetch(`${base}/api/project`);assert.equal(loaded.status,200);const loadedBody=await loaded.json();assert.equal(loadedBody.format,'vertax-browser-project');assert.equal(loadedBody.project.manifest.name,'Reference Slice');
  } finally {child?.kill();await rm(parent,{recursive:true,force:true})}
});
