import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=(...args)=>spawnSync(process.execPath,['dist/apps/cli/src/main.js',...args],{encoding:'utf8'});
test('CLI analyzes persisted English pack into explicit semantic candidates',()=>{
 const r=run('analyze-project','language-packs/english.vertax','The person cooks the food.');
 assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout);
 assert.equal(j.candidates.length,1);assert.equal(j.candidates[0].meaning.objects.event.conceptId,'sem:event.cook');
});
test('CLI translates using shared MeaningGraph and a target pack',()=>{
 const r=run('translate-project','language-packs/english.vertax','language-packs/english.vertax','The person cooks the food.');
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'The person cooks the food.\n');
});
test('CLI refuses ambiguous translation until an interpretation is selected',()=>{
 const r=run('translate-project','language-packs/english.vertax','language-packs/english.vertax','I saw the man with the telescope.');
 assert.notEqual(r.status,0);assert.match(r.stderr,/AMBIGUOUS_ANALYSIS/);assert.match(r.stderr,/meaning:/);
});
test('CLI reports explicit unknown/unsupported source instead of empty success',()=>{
 const r=run('analyze-project','language-packs/english.vertax','The person flibbertigibbets the food.');
 assert.notEqual(r.status,0);assert.match(r.stderr,/NO_ANALYSIS_CANDIDATES/);
});
test('CLI executes bundled English persisted corpus and reports real pass/fail counts',()=>{
 const r=run('test-project','language-packs/english.vertax');assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/\d+\/\d+ passed/);
});
