import type { StudioState } from '../../../packages/studio-model/src/index.js';
import { removeSelected, selectedInspectorModel, updateNodeParams } from '../../../packages/studio-model/src/index.js';
import {parseTypedParameter} from './typed-parameter.js';
export function renderInspector(container:HTMLElement,state:StudioState,onChange:(state:StudioState)=>void,onError?:(message:string)=>void):void{
  container.replaceChildren();const title=document.createElement('h2');title.textContent='Inspector';container.append(title);const model=selectedInspectorModel(state);
  if(model.kind==='graph'){const summary=document.createElement('div');summary.className='inspector-summary';summary.textContent=`${model.graphId??'No graph'} · ${model.nodeCount} nodes · ${model.edgeCount} edges`;container.append(summary);return}
  if(model.kind==='edge'){const info=document.createElement('div');info.className='inspector-summary';info.textContent=`${model.source} → ${model.target}`;container.append(info);const del=document.createElement('button');del.className='inspector-action danger';del.textContent='Delete edge';del.onclick=()=>{const result=removeSelected(state);result.diagnostics.length?onError?.(result.diagnostics[0].message):onChange(result.state)};container.append(del);return}
  const type=document.createElement('div');type.className='inspector-type';type.textContent=model.typeId;container.append(type);const id=document.createElement('code');id.textContent=model.nodeId;container.append(id);
  const definition=state.nodeDefinitions.find(def=>def.typeId===model.typeId);
  if(definition?.authoring?.parameters?.length){
    const heading=document.createElement('h3');heading.className='inspector-form-heading';heading.textContent=definition.authoring.label;container.append(heading);
    if(definition.authoring.description){const help=document.createElement('p');help.className='inspector-form-help';help.textContent=definition.authoring.description;container.append(help)}
    for(const descriptor of definition.authoring.parameters){
      const wrapper=document.createElement('label');wrapper.className='inspector-field';wrapper.textContent=descriptor.label;
      let input:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
      const value=model.params[descriptor.id];
      if(descriptor.kind==='select'||descriptor.kind==='table'){
        const select=document.createElement('select');
        const options=descriptor.kind==='table'?['',...Object.keys(state.project.tables).sort()]:['',...(descriptor.options??[])];
        for(const choice of options){const option=document.createElement('option');option.value=choice;option.textContent=choice||'(none)';select.append(option)}
        select.value=value===undefined?'':String(value);input=select;
      }else if(descriptor.kind==='json'){
        const area=document.createElement('textarea');area.className='params-json';area.rows=3;area.value=value===undefined?'{}':JSON.stringify(value,null,2);input=area;
      }else{
        const field=document.createElement('input');field.type=descriptor.kind==='boolean'?'checkbox':descriptor.kind==='number'?'number':'text';
        if(descriptor.kind==='boolean')field.checked=value===true;else field.value=value===undefined?'':String(value);input=field;
      }
      input.setAttribute('aria-label',descriptor.label);
      input.onchange=()=>{
        try{
          const raw=input instanceof HTMLInputElement&&input.type==='checkbox'?input.checked:input.value;
          const parsed=parseTypedParameter(descriptor,raw,Object.keys(state.project.tables));
          const updated=updateNodeParams(state,model.nodeId,{...model.params,[descriptor.id]:parsed});
          updated.diagnostics.length?onError?.(updated.diagnostics[0].message):onChange(updated.state);
        }catch(error){onError?.(error instanceof Error?error.message:String(error))}
      };
      wrapper.append(input);container.append(wrapper);
    }
  }
  const label=document.createElement('label');label.textContent='Advanced parameters (JSON)';const area=document.createElement('textarea');area.className='params-json';area.value=JSON.stringify(model.params,null,2);label.append(area);container.append(label);const apply=document.createElement('button');apply.className='inspector-action';apply.textContent='Apply parameters';apply.onclick=()=>{try{const parsed=JSON.parse(area.value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Parameters must be a JSON object.');const result=updateNodeParams(state,model.nodeId,parsed);result.diagnostics.length?onError?.(result.diagnostics[0].message):onChange(result.state)}catch(error){onError?.(error instanceof Error?error.message:String(error))}};container.append(apply);
  const ports=document.createElement('div');ports.className='inspector-ports';for(const port of model.ports){const line=document.createElement('div');line.textContent=`${port.direction} ${port.portId}: ${port.acceptedTypes.join(' | ')} [${port.cardinality}]`;ports.append(line)}container.append(ports);const del=document.createElement('button');del.className='inspector-action danger';del.textContent='Delete node';del.onclick=()=>{const result=removeSelected({...state,selection:{kind:'node',id:model.nodeId}});result.diagnostics.length?onError?.(result.diagnostics[0].message):onChange(result.state)};container.append(del);
}
