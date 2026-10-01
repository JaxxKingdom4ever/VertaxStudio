import { readFile, writeFile, mkdir, rm, rename, realpath } from "node:fs/promises";
import { resolve, join, dirname, basename, relative, isAbsolute } from "node:path";
import type { CompilerStage, Diagnostic, StableId } from "../../core-types/src/index.js";
import type { ConceptDefinition, DataTable, Lexeme } from "../../primitives/src/index.js";
import { decodeGraphLayoutDocument, decodeStageGraphDocument, type StageGraphDocument } from "./graph-documents.js";
import type { ProjectManifestV2 } from "./manifest.js";
import { createDefaultMigrationRegistry, migrateManifest } from "./migrations.js";
import type { LoadedVertaxProject } from "./model.js";
import { decodeNodeGroupDocument, type NodeGroupDocument } from "./node-groups.js";
import { decodeConcepts, decodeDataTable, decodeFeatures, decodeLexicon } from "./resources.js";
import { decodePersistedTestDocument, type PersistedTestDocument } from "./tests-model.js";
import { validateProject } from "./validation.js";

export interface LoadProjectResult { readonly project?: LoadedVertaxProject; readonly diagnostics: readonly Diagnostic[]; }
export interface SaveProjectResult { readonly diagnostics: readonly Diagnostic[]; readonly success:boolean; }
export interface SafePathResult { readonly path?:string; readonly diagnostics:readonly Diagnostic[]; }
function err(code:string,message:string):Diagnostic{return {severity:"Error",code,message}}
function rec(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v)}
export function resolveProjectPath(rootPath:string,manifestPath:string):SafePathResult{
  if(!manifestPath || manifestPath.includes("\0") || isAbsolute(manifestPath) || manifestPath.replaceAll("\\","/").split("/").includes("..")) return {diagnostics:[err("UNSAFE_PROJECT_PATH",`Project path ${manifestPath} escapes the project root.`)]};
  const root=resolve(rootPath); const candidate=resolve(root,manifestPath); const rel=relative(root,candidate);
  if(rel.startsWith("..")||isAbsolute(rel))return {diagnostics:[err("UNSAFE_PROJECT_PATH",`Project path ${manifestPath} escapes the project root.`)]};
  return {path:candidate,diagnostics:[]};
}
async function exists(path:string):Promise<boolean>{try{await readFile(join(path,"project.json"),"utf8");return true}catch{return false}}
async function readJson(root:string,relPath:string):Promise<{value?:unknown;diagnostics:Diagnostic[]}>{
  const safe=resolveProjectPath(root,relPath); if(!safe.path)return {diagnostics:[...safe.diagnostics]};
  try{
    const [realRoot,realTarget]=await Promise.all([realpath(resolve(root)),realpath(safe.path)]);
    const rel=relative(realRoot,realTarget);
    if(rel.startsWith("..")||isAbsolute(rel))return {diagnostics:[err("UNSAFE_PROJECT_PATH",`Project path ${relPath} resolves outside the project root.`)]};
    return {value:JSON.parse(await readFile(realTarget,"utf8")),diagnostics:[]};
  }catch(e){return {diagnostics:[err("PROJECT_LOAD_FAILED",`Could not read ${relPath}: ${e instanceof Error?e.message:String(e)}`)]};}
}
function insert<T extends {id:StableId}>(target:Record<StableId,T>,items:readonly T[],diagnostics:Diagnostic[]):void{for(const item of items){if(target[item.id])diagnostics.push(err("DUPLICATE_RESOURCE_ID",`Duplicate resource ID ${item.id}.`));else target[item.id]=item}}
export async function loadProject(rootPath:string):Promise<LoadProjectResult>{
  const diagnostics:Diagnostic[]=[]; const manifestRaw=await readJson(rootPath,"project.json"); diagnostics.push(...manifestRaw.diagnostics); if(!manifestRaw.value)return {diagnostics};
  const manifestResult=migrateManifest(manifestRaw.value,createDefaultMigrationRegistry()); diagnostics.push(...manifestResult.diagnostics); const manifest=manifestResult.manifest; if(!manifest)return {diagnostics};
  const concepts:Record<StableId,ConceptDefinition>={}; const features:Record<StableId,import("../../core-types/src/index.js").FeatureDefinition>={}; const lexemes:Record<StableId,Lexeme>={}; const tables:Record<StableId,DataTable>={};
  const stageDocuments:StageGraphDocument[]=[]; const layouts:Record<StableId,import("./graph-documents.js").GraphLayoutDocument>={}; const nodeGroups:Record<StableId,NodeGroupDocument>={}; const tests:Record<StableId,PersistedTestDocument>={}; let settings:Record<string,unknown>={};
  for(const p of manifest.concepts){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodeConcepts(r.value);diagnostics.push(...d.diagnostics);if(d.value)insert(concepts,d.value,diagnostics)}}
  for(const p of manifest.features){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodeFeatures(r.value);diagnostics.push(...d.diagnostics);if(d.value)insert(features,d.value,diagnostics)}}
  for(const p of manifest.lexicons){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodeLexicon(r.value);diagnostics.push(...d.diagnostics);if(d.value)insert(lexemes,d.value,diagnostics)}}
  for(const p of manifest.tables){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodeDataTable(r.value);diagnostics.push(...d.diagnostics);if(d.value)insert(tables,[d.value],diagnostics)}}
  for(const paths of Object.values(manifest.graphs))for(const p of paths??[]){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodeStageGraphDocument(r.value);diagnostics.push(...d.diagnostics);if(d.value)stageDocuments.push(d.value)}}
  for(const p of manifest.layouts){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodeGraphLayoutDocument(r.value);diagnostics.push(...d.diagnostics);if(d.value){if(layouts[d.value.graph_id])diagnostics.push(err("DUPLICATE_RESOURCE_ID",`Duplicate layout for ${d.value.graph_id}.`));else layouts[d.value.graph_id]=d.value}}}
  for(const p of manifest.node_groups){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodeNodeGroupDocument(r.value);diagnostics.push(...d.diagnostics);if(d.value)insert(nodeGroups,[d.value],diagnostics)}}
  for(const p of manifest.tests){const r=await readJson(rootPath,p);diagnostics.push(...r.diagnostics);if(r.value){const d=decodePersistedTestDocument(r.value);diagnostics.push(...d.diagnostics);if(d.value)insert(tests,[d.value],diagnostics)}}
  const sr=await readJson(rootPath,manifest.settings);diagnostics.push(...sr.diagnostics);if(sr.value!==undefined){if(rec(sr.value))settings=sr.value;else diagnostics.push(err("INVALID_PROJECT_SETTINGS","Project settings must be an object."));}
  if(diagnostics.some(d=>d.severity==="Error"||d.severity==="Fatal"))return {diagnostics};
  const project:LoadedVertaxProject={manifest,concepts,features,lexemes,tables,stageDocuments,layouts,nodeGroups,tests,settings};
  diagnostics.push(...validateProject(project));
  if(diagnostics.some(d=>d.severity==="Error"||d.severity==="Fatal"))return {diagnostics};
  return {project,diagnostics};
}
function pretty(v:unknown):string{return JSON.stringify(v,null,2)+"\n"}
function canonicalManifest(project:LoadedVertaxProject):ProjectManifestV2{
  const graphs:Partial<Record<CompilerStage,string[]>>={};
  for(const doc of [...project.stageDocuments].sort((a,b)=>a.stage.localeCompare(b.stage)||a.graph.id.localeCompare(b.graph.id))){(graphs[doc.stage]??=[]).push(`graphs/${doc.stage.toLowerCase()}/${doc.graph.id}.json`)}
  return {schema_version:2,id:project.manifest.id,name:project.manifest.name,version:project.manifest.version,default_language:project.manifest.default_language,graphs,lexicons:["lexicon/lexicon.json"],features:["features/features.json"],concepts:["concepts/concepts.json"],tables:Object.keys(project.tables).sort().map(id=>`tables/${id}.json`),node_groups:Object.keys(project.nodeGroups).sort().map(id=>`node-groups/${id}.json`),tests:Object.keys(project.tests).sort().map(id=>`tests/${id}.json`),settings:"settings.json",layouts:Object.keys(project.layouts).sort().map(id=>`layouts/${id}.json`),dependencies:project.manifest.dependencies,...("language" in project.manifest&&project.manifest.language?{language:project.manifest.language}:{})};
}
function serializeProject(project:LoadedVertaxProject):Map<string,string>{
  const docs=new Map<string,string>(); const manifest=canonicalManifest(project); docs.set("project.json",pretty(manifest)); docs.set("concepts/concepts.json",pretty(Object.values(project.concepts))); docs.set("features/features.json",pretty(Object.values(project.features))); docs.set("lexicon/lexicon.json",pretty(Object.values(project.lexemes))); docs.set("settings.json",pretty(project.settings));
  for(const [id,t] of Object.entries(project.tables))docs.set(`tables/${id}.json`,pretty(t));
  for(const d of project.stageDocuments)docs.set(`graphs/${d.stage.toLowerCase()}/${d.graph.id}.json`,pretty(d));
  for(const [id,l] of Object.entries(project.layouts))docs.set(`layouts/${id}.json`,pretty(l));
  for(const [id,g] of Object.entries(project.nodeGroups))docs.set(`node-groups/${id}.json`,pretty(g));
  for(const [id,t] of Object.entries(project.tests))docs.set(`tests/${id}.json`,pretty(t));
  return docs;
}
export async function saveProject(rootPath:string,project:LoadedVertaxProject):Promise<SaveProjectResult>{
  let docs:Map<string,string>; try{docs=serializeProject(project)}catch(e){return {success:false,diagnostics:[err("PROJECT_SERIALIZATION_FAILED",e instanceof Error?e.message:String(e))]}};
  const root=resolve(rootPath), parent=dirname(root), name=basename(root); const suffix=`${Date.now()}-${Math.random().toString(16).slice(2)}`; const temp=join(parent,`${name}.tmp-${suffix}`), backup=join(parent,`${name}.bak-${suffix}`);
  try{
    await rm(temp,{recursive:true,force:true}); await mkdir(temp,{recursive:true});
    for(const [relPath,text] of docs){const safe=resolveProjectPath(temp,relPath);if(!safe.path)throw new Error(`Unsafe generated path ${relPath}`);await mkdir(dirname(safe.path),{recursive:true});await writeFile(safe.path,text,"utf8");}
    const hadExisting=await exists(root);
    if(hadExisting)await rename(root,backup);
    try{await rename(temp,root)}catch(e){if(hadExisting)await rename(backup,root);throw e}
    if(hadExisting)await rm(backup,{recursive:true,force:true});
    return {success:true,diagnostics:[]};
  }catch(e){await rm(temp,{recursive:true,force:true});return {success:false,diagnostics:[err("PROJECT_SAVE_FAILED",e instanceof Error?e.message:String(e))]};}
}
