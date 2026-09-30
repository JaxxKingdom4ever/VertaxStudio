import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
let nextPort=47000+(process.pid%1000);
async function server(){
 const port=nextPort++;const child=spawn(process.execPath,['apps/studio/server.mjs'],{cwd:new URL('../../..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{let data='';child.stdout.on('data',x=>{data+=x;if(data.includes('Vertax Studio:'))resolve()});child.on('exit',x=>reject(Error(`exit ${x}: ${data}`)));setTimeout(()=>reject(Error('timeout')),5000).unref()});
 return {base:`http://127.0.0.1:${port}`,close(){child.kill()}};
}
test('server lists only bounded read-only catalog packs, without exposing arbitrary paths',async()=>{
 const s=await server();try{
  const list=await fetch(`${s.base}/api/language-packs`);assert.equal(list.status,200);
  const entries=await list.json();assert.equal(entries.length,2);assert.equal(entries[0].id,'english-pack');assert.equal(entries[1].id,'reference-conlang');
  const pack=await fetch(`${s.base}/api/language-packs/english-pack`);assert.equal(pack.status,200);assert.equal((await pack.json()).project.manifest.language.tag,'en');
  const reference=await fetch(`${s.base}/api/language-packs/reference-conlang`);assert.equal(reference.status,200);assert.equal((await reference.json()).project.manifest.language.tag,'x-vertax-reference');
  assert.equal((await fetch(`${s.base}/api/language-packs/..%2f..%2fpackage.json`)).status,404);
 } finally{s.close()}
});
test('server translates only catalog-listed packs and represents ambiguity explicitly',async()=>{
 const s=await server();try{
  const post=body=>fetch(`${s.base}/api/translation`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const good=await post({sourcePack:'english-pack',targetPack:'english-pack',text:'The person cooks the food.'});assert.equal(good.status,200);
  assert.equal((await good.json()).surface,'The person cooks the food.');
  const translated=await post({sourcePack:'english-pack',targetPack:'reference-conlang',text:'The person cooks the food.'});
  assert.equal(translated.status,200);assert.equal((await translated.json()).surface,'person cook food');
  const amb=await post({sourcePack:'english-pack',targetPack:'english-pack',text:'I saw the man with the telescope.'});assert.equal(amb.status,409);assert.equal((await amb.json()).needsSelection,true);
  const illegal=await post({sourcePack:'../../etc/passwd',targetPack:'english-pack',text:'x'});assert.equal(illegal.status,404);
 } finally{s.close()}
});
