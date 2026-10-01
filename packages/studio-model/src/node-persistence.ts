import { saveProject, validateProject } from '../../project-model/src/index.js';
import type { Diagnostic } from '../../core-types/src/index.js';
import type { StudioState } from './model.js';
import { validateStudioState } from './validation.js';
export interface SaveStudioResult { readonly success:boolean; readonly diagnostics:readonly Diagnostic[]; }
export async function saveStudioProject(state:StudioState,projectPath:string):Promise<SaveStudioResult>{const diagnostics=[...validateStudioState(state),...validateProject(state.project)];if(diagnostics.some(d=>d.severity==='Error'||d.severity==='Fatal'))return {success:false,diagnostics};return saveProject(projectPath,state.project)}
