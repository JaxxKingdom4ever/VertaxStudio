import type { Diagnostic } from '../../../packages/core-types/src/index.js';
import type { NodeDefinition } from '../../../packages/runtime/src/index.js';
import type { LoadedVertaxProject } from '../../../packages/project-model/src/model.js';
import { validateProject } from '../../../packages/project-model/src/validation.js';
import { createStudioState, type StudioState } from '../../../packages/studio-model/src/index.js';
export interface BrowserImportResult { readonly state?:StudioState; readonly diagnostics:readonly Diagnostic[]; }
export interface BrowserServerSaveResult { readonly success:boolean; readonly diagnostics:readonly Diagnostic[]; }
export function exportBrowserProject(state:StudioState):string{return JSON.stringify({format:'vertax-browser-project',version:1,project:state.project},null,2)}
export function importBrowserProject(text:string,nodeDefinitions:readonly NodeDefinition[]=[]):BrowserImportResult{try{const raw=JSON.parse(text) as {format?:unknown;version?:unknown;project?:unknown};if(raw.format!=='vertax-browser-project'||raw.version!==1||!raw.project||typeof raw.project!=='object')return {diagnostics:[{severity:'Error',code:'INVALID_BROWSER_PROJECT',message:'Browser project payload is invalid.'}]};const project=raw.project as LoadedVertaxProject;const diagnostics=validateProject(project);if(diagnostics.some(d=>d.severity==='Error'||d.severity==='Fatal'))return {diagnostics};return {state:createStudioState(project,nodeDefinitions),diagnostics}}catch(error){return {diagnostics:[{severity:'Error',code:'INVALID_BROWSER_PROJECT',message:error instanceof Error?error.message:String(error)}]}}
}
export async function saveBrowserProjectToServer(state:StudioState):Promise<BrowserServerSaveResult>{try{const response=await fetch('/api/project',{method:'POST',headers:{'content-type':'application/json'},body:exportBrowserProject(state)});const body=await response.json() as BrowserServerSaveResult;return body}catch(error){return {success:false,diagnostics:[{severity:'Error',code:'STUDIO_SERVER_UNAVAILABLE',message:error instanceof Error?error.message:String(error)}]}}
}
export async function loadBrowserProjectFromServer(nodeDefinitions:readonly NodeDefinition[]=[]):Promise<BrowserImportResult>{try{const response=await fetch('/api/project');if(!response.ok)return {diagnostics:[]};return importBrowserProject(await response.text(),nodeDefinitions)}catch{return {diagnostics:[]}}
}
