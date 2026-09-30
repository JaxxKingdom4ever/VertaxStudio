import {resolveListenHost} from './network.mjs';
import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=resolve(fileURLToPath(new URL('../..', import.meta.url)));
const publicRoot=join(repoRoot,'dist','apps','studio','public');
const distRoot=join(repoRoot,'dist');
const projectPath=resolve(process.env.VERTAX_STUDIO_PROJECT??join(repoRoot,'.studio-workspace','Reference.vertax'));
const packRoot=join(repoRoot,'language-packs');
const exampleRoot=join(repoRoot,'examples');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const { loadProject }=await import(new URL('../../dist/packages/project-model/src/io.js',import.meta.url));
const { createStudioState }=await import(new URL('../../dist/packages/studio-model/src/project-session.js',import.meta.url));
const { saveStudioProject }=await import(new URL('../../dist/packages/studio-model/src/node-persistence.js',import.meta.url));
const { toAnalyzerProject, toCompilerProject }=await import(new URL('../../dist/packages/project-model/src/compiler-adapter.js',import.meta.url));
const { registerPersistedNodeGroups }=await import(new URL('../../dist/packages/project-model/src/node-group-runtime.js',import.meta.url));
const { NodeRegistry }=await import(new URL('../../dist/packages/runtime/src/node-registry.js',import.meta.url));
const { registerCorePrimitives }=await import(new URL('../../dist/packages/primitives/src/index.js',import.meta.url));
const { translateSurface }=await import(new URL('../../dist/packages/translation/src/index.js',import.meta.url));

async function catalog(){
  const items=JSON.parse(await readFile(join(packRoot,'index.json'),'utf8'));
  return items.filter(x=>typeof x.id==='string'&&/^[A-Za-z0-9-]+$/.test(x.id)&&typeof x.path==='string'&&/^[A-Za-z0-9_.-]+\.vertax$/.test(x.path)&&(x.scope===undefined||x.scope==='examples'));
}
async function catalogPack(id){
  const entry=(await catalog()).find(x=>x.id===id);
  if(!entry)return undefined;
  const root=entry.scope==='examples'?exampleRoot:packRoot;
  const realRoot=await realpath(root);const absolute=await realpath(join(root,entry.path));
  if(!absolute.startsWith(realRoot+sep))return undefined;
  const loaded=await loadProject(absolute);
  return loaded.project?{entry,project:loaded.project}:undefined;
}

function safe(base, requestPath){const decoded=decodeURIComponent(requestPath.split('?')[0]);const candidate=resolve(base,'.'+normalize(decoded));return candidate===base||candidate.startsWith(base+sep)?candidate:undefined}
function json(res,status,value){const body=JSON.stringify(value);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)});res.end(body)}
async function readJsonBody(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>10_000_000)throw new Error('Request body too large.');chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
async function handleApi(req,res,path){
  if(path==='/api/language-packs'&&req.method==='GET'){
    const entries=await catalog();json(res,200,entries);return true;
  }
  if(path.startsWith('/api/language-packs/')&&req.method==='GET'){
    const id=decodeURIComponent(path.slice('/api/language-packs/'.length));
    const pack=await catalogPack(id);
    if(!pack){json(res,404,{code:'UNKNOWN_LANGUAGE_PACK'});return true}
    json(res,200,{format:'vertax-browser-project',version:1,id,project:pack.project});return true;
  }
  if(path==='/api/translation'&&req.method==='POST'){
    try{
      const body=await readJsonBody(req);
      if(typeof body?.text!=='string'||body.text.length>10000||typeof body?.sourcePack!=='string'||typeof body?.targetPack!=='string'||(body.candidateId!==undefined&&typeof body.candidateId!=='string')){
        json(res,400,{code:'INVALID_TRANSLATION_REQUEST'});return true;
      }
      const [source,target]=await Promise.all([catalogPack(body.sourcePack),catalogPack(body.targetPack)]);
      if(!source||!target){json(res,404,{code:'UNKNOWN_LANGUAGE_PACK'});return true}
      const analyzer=toAnalyzerProject(source.project),generator=toCompilerProject(target.project);
      if(!analyzer.project||!generator.project){json(res,422,{success:false,diagnostics:[...analyzer.diagnostics,...generator.diagnostics]});return true}
      const sourceRegistry=new NodeRegistry();registerCorePrimitives(sourceRegistry);registerPersistedNodeGroups(sourceRegistry,source.project.nodeGroups);
      const targetRegistry=new NodeRegistry();registerCorePrimitives(targetRegistry);registerPersistedNodeGroups(targetRegistry,target.project.nodeGroups);
      const result=translateSurface({sourceProject:analyzer.project,sourceRegistry,targetProject:generator.project,targetRegistry,sourceLoaded:source.project,targetLoaded:target.project,text:body.text,candidateId:body.candidateId,options:{mode:'trace',maxStepsPerStage:200}});
      json(res,result.success?200:result.needsSelection?409:422,result);return true;
    }catch(error){json(res,400,{success:false,code:'INVALID_TRANSLATION_REQUEST',message:error instanceof Error?error.message:String(error)});return true}
  }
  if(path!=='/api/project')return false;
  if(req.method==='GET'){
    const loaded=await loadProject(projectPath);if(!loaded.project){json(res,404,{success:false,diagnostics:loaded.diagnostics});return true}
    json(res,200,{format:'vertax-browser-project',version:1,project:loaded.project});return true;
  }
  if(req.method==='POST'){
    try{const raw=await readJsonBody(req);if(raw?.format!=='vertax-browser-project'||raw?.version!==1||!raw?.project||typeof raw.project!=='object'){json(res,400,{success:false,diagnostics:[{severity:'Error',code:'INVALID_BROWSER_PROJECT',message:'Browser project payload is invalid.'}]});return true}
      const result=await saveStudioProject(createStudioState(raw.project),projectPath);json(res,result.success?200:400,result);return true;
    }catch(error){json(res,400,{success:false,diagnostics:[{severity:'Error',code:'INVALID_BROWSER_PROJECT',message:error instanceof Error?error.message:String(error)}]});return true}
  }
  json(res,405,{success:false,diagnostics:[{severity:'Error',code:'METHOD_NOT_ALLOWED',message:'Method not allowed.'}]});return true;
}

createServer(async(req,res)=>{try{let path=req.url??'/';const pathname=path.split('?')[0];if(await handleApi(req,res,pathname))return;if(path==='/') path='/index.html';let file=safe(publicRoot,path);if(path.startsWith('/apps/')||path.startsWith('/packages/')||path.startsWith('/examples/')) file=safe(distRoot,path);if(!file||(await stat(file)).isDirectory()) throw new Error('not found');const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}).listen(Number(process.env.PORT??4173),resolveListenHost(process.env),()=>console.log(`Vertax Studio: http://localhost:${process.env.PORT??4173}`));
