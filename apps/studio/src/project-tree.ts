import { buildProjectTree, type StudioState } from '../../../packages/studio-model/src/index.js';
export function renderProjectTree(container:HTMLElement,state:StudioState,onSelect:(stage:string,id:string)=>void,onResource?:(id:string)=>void):void{
  container.replaceChildren();
  const title=document.createElement('h2');title.textContent='Project';container.append(title);
  for(const item of buildProjectTree(state)){
    if(item.kind==='resource'){
      const button=document.createElement('button');button.className='tree-item tree-resource';button.textContent=item.label;button.onclick=()=>onResource?.(item.id);container.append(button);continue;
    }
    const section=document.createElement('section');section.className='tree-section';
    const label=document.createElement('div');label.className='tree-section-label';label.textContent=item.label;section.append(label);
    for(const child of item.children){const button=document.createElement('button');button.className='tree-item';button.textContent=child.label;button.onclick=()=>child.stage&&child.targetId&&onSelect(child.stage,child.targetId);section.append(button)}
    container.append(section);
  }
}
