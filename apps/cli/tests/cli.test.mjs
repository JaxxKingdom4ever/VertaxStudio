import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveProject } from "../../../dist/packages/project-model/src/index.js";
import { referencePersistedProject } from "../../../dist/examples/reference-slice/persisted-project.js";

function run(...args){ return spawnSync(process.execPath,["dist/apps/cli/src/main.js",...args],{encoding:"utf8"}); }

test("compile prints exact surface and exits zero",()=>{
 const result=run("compile"); assert.equal(result.status,0); assert.equal(result.stdout,"person'vo duru esi'cook food\n");
});

test("trace prints surface and compiler stage names",()=>{
 const result=run("trace"); assert.equal(result.status,0); assert.match(result.stdout,/^person'vo duru esi'cook food/m); assert.match(result.stdout,/Grammar/); assert.match(result.stdout,/Morphology/); assert.match(result.stdout,/Surface/);
});

test("validate-project prints valid project summary and exits zero",async()=>{
  const parent=await mkdtemp(join(tmpdir(),"vertax-cli-valid-")); const root=join(parent,"Reference.vertax");
  try{
    const saved=await saveProject(root,referencePersistedProject); assert.equal(saved.success,true);
    const result=run("validate-project",root);
    assert.equal(result.status,0);
    assert.equal(result.stdout,"Valid Vertax project: Reference Slice (schema 2)\n");
  } finally { await rm(parent,{recursive:true,force:true}); }
});

test("validate-project prints diagnostic codes and exits non-zero for invalid project",async()=>{
  const parent=await mkdtemp(join(tmpdir(),"vertax-cli-invalid-")); const root=join(parent,"Bad.vertax");
  try{
    await mkdir(root,{recursive:true});
    await writeFile(join(root,"project.json"),JSON.stringify({schema_version:3,id:"bad"}),"utf8");
    const result=run("validate-project",root);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/UNSUPPORTED_PROJECT_SCHEMA/);
  } finally { await rm(parent,{recursive:true,force:true}); }
});

test('default CLI demo runs persisted four-stage reference pack rather than legacy reference code',()=>{
  const result=run('trace');
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/^person'vo duru esi'cook food/m);
  assert.match(result.stdout,/Phonology:/);
  assert.match(result.stdout,/reference-grammar-rule/);
});
