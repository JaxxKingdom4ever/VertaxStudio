import type {SemanticObject,SemanticType,StableId} from '../../../packages/core-types/src/index.js';
import {addSemanticObject,removeSemanticObject,setSemanticRoots,setSemanticRole,updateSemanticObject,buildMeaningTree,type SentenceLabState,type MeaningComposerView} from '../../../packages/sentence-lab/src/index.js';

const make=(tag:string,text?:string,className?:string):HTMLElement=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e};
const btn=(title:string,fn:()=>void)=>{const e=document.createElement('button');e.textContent=title;e.onclick=fn;return e};
const entityTypes:SemanticType[]=['Entity','Group','Event','State','Property','Relation','Quantity','Proposition','Unknown','Reference','Modality','SemanticList'];
const idChoice=(ids:readonly string[])=>{const select=document.createElement('select');for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=id;select.append(option)}return select};
const viewNames:MeaningComposerView[]=['Form','Tree','Graph'];
const semanticLabel=(obj:SemanticObject|undefined,id:string):string=>obj?`${id} · ${obj.type} · ${obj.conceptId??'unassigned'}`:id;
const nextId=(ids:readonly string[])=>{let n=1;while(ids.includes(`semantic-${n}`))n++;return `semantic-${n}`};

/** All three views operate directly on one SemanticGraph, never a duplicate form model. */
export function renderMeaningComposer(container:HTMLElement,state:SentenceLabState,onChange:(state:SentenceLabState)=>void):void{
 container.replaceChildren();container.append(make('h3','Meaning Composer'));
 const graph=state.meaningGraph;
 const update=(value:SentenceLabState)=>onChange({...value,result:undefined,traceCursor:undefined});
 const error=(message:string)=>{const e=make('div',message,'composer-error');container.prepend(e)};
 const views=make('div',undefined,'composer-view-tabs');
 for(const name of viewNames){const control=btn(name,()=>onChange({...state,composerView:name}));if(name===state.composerView)control.className='selected';views.append(control)}container.append(views);
 const source=make('label','Optional source text (context only — never parsed)');const sourceInput=document.createElement('textarea');sourceInput.value=state.sourceText;sourceInput.rows=2;sourceInput.onchange=()=>onChange({...state,sourceText:sourceInput.value});source.append(sourceInput);container.append(source);
 const ids=Object.keys(graph.objects).sort();const selected=ids.includes(state.selectedValueId??'')?state.selectedValueId!:graph.roots[0]??ids[0];
 const toolbar=make('div',undefined,'composer-object-toolbar');
 const list=idChoice(ids);if(selected)list.value=selected;list.onchange=()=>onChange({...state,selectedValueId:list.value});toolbar.append(list);
 const typeSelect=idChoice(entityTypes);typeSelect.value='Entity';typeSelect.setAttribute('aria-label','New semantic type');toolbar.append(typeSelect);
 toolbar.append(btn('+ Object',()=>{
   const id=nextId(ids);const obj:SemanticObject={id,type:typeSelect.value as SemanticType,roles:{},features:{values:{}}};
   const result=addSemanticObject(graph,obj);if(result.diagnostics.length){error(result.diagnostics[0]!.message);return;}
   const withRoot=graph.roots.length?result.graph:setSemanticRoots(result.graph,[id]).graph;
   update({...state,meaningGraph:withRoot,selectedValueId:id});
 }));container.append(toolbar);
 if(state.composerView==='Tree'){
   const tree=make('div',undefined,'meaning-tree');
   const draw=(node:ReturnType<typeof buildMeaningTree>[number],depth:number):HTMLElement=>{
     const item=make('div',undefined,'meaning-tree-node');item.style.paddingLeft=`${Math.min(depth,14)*12}px`;
     const label=semanticLabel(graph.objects[node.objectId],node.objectId);
     const mark=node.cyclic?' ↻ cycle':node.repeated?' ↗ shared':'';
     item.append(btn(`${node.role?node.role+' → ':''}${label}${mark}`,()=>onChange({...state,selectedValueId:node.objectId,composerView:'Form'})));
     const parent=make('div');parent.append(item);for(const child of node.children)parent.append(draw(child,depth+1));return parent;
   };
   for(const root of buildMeaningTree(graph))tree.append(draw(root,0));
   if(!tree.childNodes.length)tree.append(make('p','Create an object to begin.'));container.append(tree);
 }else if(state.composerView==='Graph'){
   const box=make('div',undefined,'meaning-graph');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.setAttribute('viewBox',`0 0 620 ${Math.max(270,Math.ceil(ids.length/3)*125+35)}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Semantic graph nodes and role edges');
   const pos=new Map(ids.map((id,i)=>[id,{x:105+(i%3)*205,y:65+Math.floor(i/3)*122}]));
   for(const obj of Object.values(graph.objects))for(const [role,refs] of Object.entries(obj.roles))for(const ref of refs){
     const from=pos.get(obj.id),to=pos.get(ref);if(!from||!to)continue;
     const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',String(from.x));line.setAttribute('y1',String(from.y));line.setAttribute('x2',String(to.x));line.setAttribute('y2',String(to.y));line.setAttribute('stroke','#7a8baa');line.setAttribute('stroke-width','2');svg.append(line);
     const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',String((from.x+to.x)/2));text.setAttribute('y',String((from.y+to.y)/2-5));text.setAttribute('fill','#e6ac90');text.setAttribute('font-size','10');text.textContent=role;svg.append(text);
   }
   for(const id of ids){const p=pos.get(id)!;const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('tabindex','0');g.style.cursor='pointer';
     const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',String(p.x-77));rect.setAttribute('y',String(p.y-26));rect.setAttribute('width','154');rect.setAttribute('height','52');rect.setAttribute('rx','9');rect.setAttribute('fill',id===selected?'#38506b':'#222c3b');rect.setAttribute('stroke',graph.roots.includes(id)?'#eac197':'#6b7f95');g.append(rect);
     const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',String(p.x));text.setAttribute('y',String(p.y+4));text.setAttribute('text-anchor','middle');text.setAttribute('fill','#e7edf5');text.setAttribute('font-size','11');text.textContent=id.slice(0,20);g.append(text);
     const choose=()=>onChange({...state,selectedValueId:id,composerView:'Form'});g.addEventListener('click',choose);g.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter')choose()});svg.append(g);
   }
   box.append(svg);container.append(box);
 }else if(selected){
   const obj=graph.objects[selected]!;const form=make('section',undefined,'composer-form');form.append(make('h4',semanticLabel(obj,selected)));
   const concept=make('label','Concept ID');const field=document.createElement('input');field.value=obj.conceptId??'';field.placeholder='sem:event.cook';field.onchange=()=>{const r=updateSemanticObject(graph,selected,{conceptId:field.value});if(r.diagnostics.length)error(r.diagnostics[0]!.message);else update({...state,meaningGraph:r.graph})};concept.append(field);form.append(concept);
   const feature=make('label','Features (JSON)');const featureArea=document.createElement('textarea');featureArea.rows=3;featureArea.value=JSON.stringify(obj.features.values,null,2);featureArea.onchange=()=>{
     try{const values=JSON.parse(featureArea.value);if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Features must be an object.');const result=updateSemanticObject(graph,selected,{features:{values}});update({...state,meaningGraph:result.graph});}
     catch(ex){error(ex instanceof Error?ex.message:String(ex))}
   };feature.append(featureArea);form.append(feature);
   form.append(btn(graph.roots.includes(selected)?'Remove from roots':'Set as root',()=>{
     const roots=graph.roots.includes(selected)?graph.roots.filter(id=>id!==selected):[...graph.roots,selected];const result=setSemanticRoots(graph,roots);update({...state,meaningGraph:result.graph});
   }));
   form.append(make('h4','Semantic roles'));
   for(const [role,refs] of Object.entries(obj.roles).sort(([a],[b])=>a.localeCompare(b))){const row=make('div',undefined,'composer-role');row.append(make('span',role+' → '+(refs.join(', ')||'∅')));row.append(btn('Remove',()=>{const result=setSemanticRole(graph,selected,role,[]);update({...state,meaningGraph:result.graph})}));form.append(row)}
   const row=make('div',undefined,'composer-add-role');const roleInput=document.createElement('input');roleInput.placeholder='agent, patient, theme…';const target=idChoice(ids.filter(x=>x!==selected));row.append(roleInput,target,btn('Add role target',()=>{
     const result=setSemanticRole(graph,selected,roleInput.value,[...(obj.roles[roleInput.value]??[]),target.value]);
     if(result.diagnostics.length)error(result.diagnostics[0]!.message);else update({...state,meaningGraph:result.graph});
   }));form.append(row);
   form.append(btn('Delete object',()=>{const result=removeSemanticObject(graph,selected);update({...state,meaningGraph:result.graph,selectedValueId:undefined})}));container.append(form);
 }
}
