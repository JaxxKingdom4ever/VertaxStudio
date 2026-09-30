import type { StudioState } from '../../../packages/studio-model/src/index.js';
import { buildBreadcrumbs, navigateToBreadcrumb } from '../../../packages/studio-model/src/index.js';
export function renderBreadcrumbs(container:HTMLElement,state:StudioState,onChange:(state:StudioState)=>void):void{
  container.replaceChildren();const crumbs=buildBreadcrumbs(state);crumbs.forEach((crumb,index)=>{if(index){const sep=document.createElement('span');sep.className='breadcrumb-sep';sep.textContent='›';container.append(sep)}const button=document.createElement('button');button.className='breadcrumb-item';button.textContent=crumb.label;button.onclick=()=>onChange(navigateToBreadcrumb(state,crumb.depth));container.append(button)});
}
