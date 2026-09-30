import type { CompilerStage } from '../../../packages/core-types/src/index.js';
import { addCatalogNode, applyStudioEdit, createStudioHistory, createStudioState, redoStudio, selectGraph, undoStudio, type StudioHistory, type StudioState } from '../../../packages/studio-model/src/index.js';
import type {LoadedVertaxProject} from '../../../packages/project-model/src/model.js';
import { NodeRegistry } from '../../../packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../../packages/primitives/src/index.js';
import { referenceStudioState } from '../../../examples/reference-slice/studio-project.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { exportBrowserProject, importBrowserProject, loadBrowserProjectFromServer, saveBrowserProjectToServer } from './browser-project.js';
import { renderGraphCanvas } from './graph-canvas.js';
import { renderInspector } from './inspector.js';
import { openNodeShelf } from './node-shelf.js';
import { renderProjectTree } from './project-tree.js';
import { renderStatusBar } from './status-bar.js';
import { renderToolbar } from './toolbar.js';
import { mountTranslationWorkspace } from './translation-workspace.js';
import { mountSentenceLab } from './sentence-lab.js';
function download(name:string,text:string){const blob=new Blob([text],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
export function mountStudio(root:HTMLElement):void{
  let history:StudioHistory=createStudioHistory(referenceStudioState);let messages:string[]=[];let cursor={x:innerWidth/2,y:innerHeight/2};
  let mode:'graph'|'translation'|'sentence'|'tests'='graph';
  const toolbar=root.querySelector<HTMLElement>('.studio-toolbar')!;const project=root.querySelector<HTMLElement>('#project-panel')!;const canvas=root.querySelector<HTMLElement>('#graph-canvas')!;const inspector=root.querySelector<HTMLElement>('#inspector-panel')!;const status=root.querySelector<HTMLElement>('#status-bar')!;const crumbs=document.createElement('div');crumbs.className='studio-breadcrumbs';canvas.before(crumbs);
  const translation=document.createElement('main');translation.id='translation-workspace';translation.className='translation-workspace';canvas.after(translation);
  const labElement=document.createElement('main');labElement.id='sentence-lab-workspace';labElement.className='sentence-lab-workspace';translation.after(labElement);
  const lab=mountSentenceLab(labElement,()=>history.present.project,()=>history.present.nodeDefinitions,(project)=>{
    history=applyStudioEdit(history,()=>({state:{...history.present,project,dirty:true},diagnostics:[]}));
    messages.push('Sentence Lab test added. Save the project to persist it.');render();
  });
  mountTranslationWorkspace(translation,(pack:LoadedVertaxProject)=>{
    const reg=new NodeRegistry();registerCorePrimitives(reg);
    history=createStudioHistory(createStudioState(pack,reg.listDefinitions()));
    mode='graph';messages.push(`Opened ${pack.manifest.name} in Graph Studio`);render();
  });
  const setPresent=(next:StudioState)=>{history=next.project===history.present.project?{...history,present:next}:applyStudioEdit(history,()=>({state:next,diagnostics:[]}));render()};const edit=(fn:(s:StudioState)=>{state:StudioState;diagnostics:readonly {message:string}[]})=>{const result=fn(history.present);if(result.diagnostics.length){messages.push(result.diagnostics[0].message);render();return}history=applyStudioEdit(history,()=>result as never);render()};
  const chooseStage=(stage:CompilerStage)=>{const doc=history.present.project.stageDocuments.find(d=>d.stage===stage);if(doc)setPresent(selectGraph(history.present,stage,doc.graph.id))};
  const saveProject=async()=>{const result=await saveBrowserProjectToServer(history.present);if(result.success){history={...history,present:{...history.present,dirty:false}};messages.push('Saved to local .vertax workspace')}else messages.push(result.diagnostics[0]?.message??'Save failed');render()};
  const exportProject=()=>download(`${history.present.project.manifest.name.replace(/\s+/g,'-')}.vertax.json`,exportBrowserProject(history.present));
  const importProject=()=>{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const result=importBrowserProject(await file.text());if(result.state){history=createStudioHistory({...result.state,nodeDefinitions:history.present.nodeDefinitions});messages.push('Project imported');render()}else{messages.push(result.diagnostics[0]?.message??'Import failed');render()}};input.click()};
  const render=()=>{renderToolbar(toolbar,history.present,{onStage:chooseStage,onUndo:()=>{history=undoStudio(history);render()},onRedo:()=>{history=redoStudio(history);render()},onSave:()=>{void saveProject()},onExport:exportProject,onImport:importProject});
    const graphButton=document.createElement('button');graphButton.textContent='Graph Studio';graphButton.className='toolbar-action';graphButton.onclick=()=>{mode='graph';render()};
    const translationButton=document.createElement('button');translationButton.textContent='Analysis / Translation';translationButton.className='toolbar-action';translationButton.onclick=()=>{mode='translation';render()};
    const sentenceButton=document.createElement('button');sentenceButton.textContent='Sentence Lab';sentenceButton.className='toolbar-action';sentenceButton.onclick=()=>{mode='sentence';render()};
    toolbar.append(graphButton,translationButton,sentenceButton);
    canvas.hidden=mode!=='graph';translation.hidden=mode!=='translation';labElement.hidden=mode!=='sentence'&&mode!=='tests';crumbs.hidden=mode!=='graph';
    if(mode==='sentence'||mode==='tests')lab.render(mode);
    renderProjectTree(project,history.present,(stage,id)=>{mode='graph';setPresent(selectGraph(history.present,stage as CompilerStage,id))},resource=>{if(resource==='resource:sentence-lab')mode='sentence';else if(resource==='resource:tests')mode='tests';render()});renderBreadcrumbs(crumbs,history.present,setPresent);renderGraphCanvas(canvas,history.present,setPresent,ds=>{messages.push(...ds);renderStatusBar(status,history.present,messages)});renderInspector(inspector,history.present,setPresent,message=>{messages.push(message);renderStatusBar(status,history.present,messages)});renderStatusBar(status,history.present,messages)};
  canvas.addEventListener('pointermove',event=>{cursor={x:event.clientX,y:event.clientY}});window.addEventListener('keydown',event=>{if(mode==='graph'&&event.code==='Space'&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes((event.target as HTMLElement)?.tagName)){event.preventDefault();openNodeShelf(history.present,cursor,entry=>{edit(state=>addCatalogNode(state,entry,{x:cursor.x,y:cursor.y}));document.querySelector('.node-shelf')?.remove()})}if(mode==='graph'&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();history=event.shiftKey?redoStudio(history):undoStudio(history);render()}});root.dataset.mounted='true';render();void loadBrowserProjectFromServer(history.present.nodeDefinitions).then(result=>{if(result.state){history=createStudioHistory(result.state);messages.push('Loaded local .vertax workspace');render()}});
}
