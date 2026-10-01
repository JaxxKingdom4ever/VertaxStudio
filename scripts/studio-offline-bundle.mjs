/**
 * Builds a single browser-test bootstrap from the *emitted* Studio modules.
 * No production bundle is modified. Useful when Chromium navigation is
 * blocked by a sandbox even though DOM execution in about:blank is allowed.
 */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
let ts;
try {ts=require('typescript')} catch {ts=require(resolve(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const dist=resolve('dist');
const entry='apps/studio/src/main.js';
const records={};
const queue=[entry];
while(queue.length){
  const id=queue.pop();
  if(Object.hasOwn(records,id))continue;
  const file=resolve(dist,id);
  if(!file.startsWith(dist+sep))throw new Error(`Module escapes dist: ${id}`);
  const js=readFileSync(file,'utf8');
  const cjs=ts.transpileModule(js,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
  records[id]=cjs;
  for(const [,specifier] of cjs.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)){
    if(!specifier.startsWith('.'))throw new Error(`Non-browser import ${specifier} from ${id}`);
    const dependency=relative(dist,resolve(dirname(file),specifier)).split(sep).join('/');
    queue.push(dependency);
  }
}
const bootstrap=`'use strict';\n(()=>{\n  const records=${JSON.stringify(records)};\n  const cache=Object.create(null);\n  function execute(id){\n    if(cache[id])return cache[id].exports;\n    if(!Object.hasOwn(records,id))throw Error('Missing browser module '+id);\n    const module={exports:{}};cache[id]=module;\n    const req=(specifier)=>{\n      if(!specifier.startsWith('.'))throw Error('Unsupported browser require '+specifier);\n      const base=id.slice(0,id.lastIndexOf('/')+1);\n      const joined=new URL(specifier,'https://vertax.invalid/'+base).pathname.slice(1);\n      return execute(joined);\n    };\n    new Function('module','exports','require',records[id]+'\\n//# sourceURL=vertax:///'+id)(module,module.exports,req);\n    return module.exports;\n  }\n  execute('${entry}');\n})();\n`;
const output=process.argv[2]??resolve('.studio-browser-bootstrap.js');
writeFileSync(output,bootstrap);
console.log(JSON.stringify({entry,moduleCount:Object.keys(records).length,bytes:Buffer.byteLength(bootstrap),output}));
