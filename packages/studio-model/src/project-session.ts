import type { CompilerStage } from '../../core-types/src/index.js';
import type { LoadedVertaxProject } from '../../project-model/src/index.js';
import type { NodeDefinition } from '../../runtime/src/index.js';
import type { StudioState, StudioWorkspace } from './model.js';

const stageOrder: readonly CompilerStage[] = ['Grammar','Meaning','Morphology','Phonology','Surface','OrthographyAnalysis','MorphologyAnalysis','GrammarAnalysis','MeaningAnalysis','Utility'];

export function createStudioState(project: LoadedVertaxProject, nodeDefinitions: readonly NodeDefinition[] = []): StudioState {
  let selected = project.stageDocuments.find(document => document.stage === 'Grammar');
  if (!selected) {
    for (const stage of stageOrder) {
      selected = project.stageDocuments.find(document => document.stage === stage);
      if (selected) break;
    }
  }
  return {
    project,
    workspace: 'GraphStudio',
    graphSelection: selected ? { stage: selected.stage, graphId: selected.graph.id, nodeGroupPath: [] } : undefined,
    selection: { kind: 'none' },
    leftPanelOpen: true,
    rightPanelOpen: true,
    dirty: false,
    nodeDefinitions: [...nodeDefinitions]
  };
}

export function selectWorkspace(state: StudioState, workspace: StudioWorkspace): StudioState {
  return workspace === state.workspace ? state : { ...state, workspace };
}

import type { ProjectTreeItem } from './model.js';
import type { StageGraphDocument, GraphLayoutDocument } from '../../project-model/src/index.js';

export function buildProjectTree(state: StudioState): readonly ProjectTreeItem[] {
  const stages:readonly CompilerStage[]=['Grammar','Morphology','Phonology','Surface',
    ...(['OrthographyAnalysis','MorphologyAnalysis','GrammarAnalysis','MeaningAnalysis'] as const)
      .filter(stage=>state.project.stageDocuments.some(document=>document.stage===stage))];
  const stageItems = stages.map(stage => ({
    id:`stage:${stage}`, label:stage, kind:'section' as const, stage,
    children: state.project.stageDocuments.filter(document=>document.stage===stage).map(document=>({
      id:`graph:${document.graph.id}`, label:document.graph.id, kind:'graph' as const, stage, targetId:document.graph.id, children:[]
    }))
  }));
  return [
    ...stageItems,
    {id:'resource:lexicon',label:'Lexicon',kind:'resource',children:[]},
    {id:'resource:tables',label:'Tables',kind:'resource',children:[]},
    {id:'resource:sentence-lab',label:'Sentence Lab',kind:'resource',children:[]},
    {id:'resource:tests',label:'Tests',kind:'resource',children:[]}
  ];
}

export function selectGraph(state: StudioState, stage: CompilerStage, graphId: string): StudioState {
  const exists=state.project.stageDocuments.some(document=>document.stage===stage&&document.graph.id===graphId);
  if(!exists) return state;
  return {...state,workspace:'GraphStudio',graphSelection:{stage,graphId,nodeGroupPath:[]},selection:{kind:'none'}};
}
export function selectedGraphDocument(state: StudioState): StageGraphDocument|undefined {
  if(!state.graphSelection) return undefined;
  return state.project.stageDocuments.find(document=>document.stage===state.graphSelection!.stage&&document.graph.id===state.graphSelection!.graphId);
}
export function selectedGraphLayout(state: StudioState): GraphLayoutDocument|undefined {
  const graph=selectedGraphDocument(state);
  return graph?state.project.layouts[graph.graph.id]:undefined;
}
