import type { CompilerStage, StableId } from '../../core-types/src/index.js';
import type { LoadedVertaxProject } from '../../project-model/src/index.js';
import type { NodeDefinition } from '../../runtime/src/index.js';

export type StudioWorkspace = 'GraphStudio' | 'Lexicon' | 'DataTables' | 'SentenceLab' | 'Tests' | 'Project';
export interface GraphSelection {
  readonly stage: CompilerStage;
  readonly graphId: StableId;
  readonly nodeGroupPath: readonly StableId[];
}
export interface StudioSelection { readonly kind: 'none' | 'node' | 'edge'; readonly id?: StableId; }
export interface StudioState {
  readonly project: LoadedVertaxProject;
  readonly workspace: StudioWorkspace;
  readonly graphSelection?: GraphSelection;
  readonly selection: StudioSelection;
  readonly leftPanelOpen: boolean;
  readonly rightPanelOpen: boolean;
  readonly dirty: boolean;
  readonly nodeDefinitions: readonly NodeDefinition[];
}

export interface ProjectTreeItem {
  readonly id: string;
  readonly label: string;
  readonly kind: 'section' | 'graph' | 'resource';
  readonly stage?: CompilerStage;
  readonly targetId?: StableId;
  readonly children: readonly ProjectTreeItem[];
}

export interface EditResult { readonly state: StudioState; readonly diagnostics: readonly import('../../core-types/src/index.js').Diagnostic[]; }
export interface PortEndpoint { readonly nodeId: StableId; readonly portId: string; }
