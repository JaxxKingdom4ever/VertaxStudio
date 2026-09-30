import type {LoadedVertaxProject} from '../../../packages/project-model/src/index.js';
import type {NodeDefinition} from '../../../packages/runtime/src/index.js';
import {createSentenceLabState,compileSentenceLab,saveSentenceLabTest,buildGlossUnits,buildStructureSections,buildSurfaceTraceSpans,type SentenceLabState,type SentenceLabOutputView} from '../../../packages/sentence-lab/src/index.js';
import {renderMeaningComposer} from './meaning-composer.js';
import {renderTraceDebugger} from './trace-debugger.js';
import {renderLabTests} from './lab-tests.js';
const elem=(tag:string,text?:string,className?:string)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e};
const action=(label:string,callback:()=>void)=>{const e=document.createElement('button');e.textContent=label;e.onclick=callback;return e};
export interface SentenceLabWorkspace {render(mode?:'sentence'|'tests'):void;}
export function mountSentenceLab(container:HTMLElement,getProject:()=>LoadedVertaxProject,getDefinitions:()=>readonly NodeDefinition[],onEditProject:(project:LoadedVertaxProject)=>void):SentenceLabWorkspace{
 let loadedProjectId:string|undefined;
 let state=createSentenceLabState();
 let localErrors:string[]=[];
 const sync=()=>{
   const project=getProject();if(project.manifest.id!==loadedProjectId){
     loadedProjectId=project.manifest.id;
     const first=project.tests['question-continuous']??Object.values(project.tests).find(t=>t.input_stage==='Meaning');
     state=createSentenceLabState(first?.input&&typeof first.input==='object'&&'objects' in first.input?first.input as SentenceLabState['meaningGraph']:undefined);
     localErrors=[];
   }
 };
 const update=(next:SentenceLabState)=>{state=next;render('sentence')};
 const render=(mode:'sentence'|'tests'='sentence')=>{
   sync();const project=getProject();container.replaceChildren();
   const heading=elem('header',undefined,'lab-header');heading.append(elem('h2',mode==='tests'?'Project Tests':'Sentence Lab'));
   heading.append(elem('p',`${project.manifest.name} · Confirmed MeaningGraph is the compilation authority.`));container.append(heading);
   if(mode==='tests'){renderLabTests(container,project);return;}
   const bar=elem('div',undefined,'lab-toolbar');
   const compile=action('▶ Compile confirmed meaning',()=>{state=compileSentenceLab(getProject(),getDefinitions(),state);localErrors=[];render()});compile.className='lab-primary';bar.append(compile);
   const modeLabel=elem('label','Execution mode');const select=document.createElement('select');for(const option of ['fast','trace','strict']){const item=document.createElement('option');item.value=option;item.textContent=option;select.append(item)}select.value=state.compileMode;select.onchange=()=>update({...state,compileMode:select.value as SentenceLabState['compileMode']});modeLabel.append(select);bar.append(modeLabel);
   const testName=document.createElement('input');testName.placeholder='Test name';testName.setAttribute('aria-label','Name of saved sentence test');bar.append(testName);
   const save=action('Save as test',()=>{
     const name=testName.value.trim()||'Lab example';const safe=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'lab-example';
     let id=safe;let i=2;while(getProject().tests[id])id=`${safe}-${i++}`;
     const result=saveSentenceLabTest(getProject(),state,{id,name});
     if(result.diagnostics.length){localErrors=result.diagnostics.map(d=>d.message);render();return}
     onEditProject(result.project);localErrors=[`Saved test ${id}. Use Studio Save to persist the project.`];render();
   });bar.append(save);container.append(bar);
   const columns=elem('div',undefined,'lab-columns');const composer=elem('section',undefined,'lab-composer');const results=elem('section',undefined,'lab-output');columns.append(composer,results);container.append(columns);
   renderMeaningComposer(composer,state,update);
   results.append(elem('h3','Compiler Output'));
   const tabs=elem('div',undefined,'lab-output-tabs');for(const name of ['Final','Gloss','Structure','Trace','Errors'] as SentenceLabOutputView[]){const tab=action(name,()=>update({...state,outputView:name}));if(state.outputView===name)tab.className='selected';tabs.append(tab)}results.append(tabs);
   const resultBody=elem('div',undefined,'lab-result-body');results.append(resultBody);
   const result=state.result;
   if(state.outputView==='Final'){
     if(result?.surface!==undefined){const final=elem('p',undefined,'lab-final');for(const span of buildSurfaceTraceSpans(result)){
       const leaf=elem('span',span.text,'lab-trace-span');leaf.title=[...(span.sourceIds.length?[`Sources: ${span.sourceIds.join(', ')}`]:[]),...(span.nodeIds.length?[`Nodes: ${span.nodeIds.join(', ')}`]:[])].join('\n')||'No recorded provenance';
       leaf.tabIndex=0;final.append(leaf);
     }resultBody.append(final)}else resultBody.append(elem('p','Compile a confirmed MeaningGraph to see the resulting sentence.'));
   }else if(state.outputView==='Gloss'){
     const gloss=elem('div',undefined,'lab-gloss');for(const unit of result?buildGlossUnits(result):[]){const cell=elem('div',undefined,'lab-gloss-unit');cell.append(elem('strong',unit.form),elem('small',`${unit.kind} · ${unit.id}`));if(Object.keys(unit.features).length)cell.append(elem('code',JSON.stringify(unit.features)));gloss.append(cell)}resultBody.append(gloss);if(!gloss.childNodes.length)resultBody.append(elem('p','No morphology output to gloss.'));
   }else if(state.outputView==='Structure'){
     for(const section of result?buildStructureSections(result):[]){resultBody.append(elem('h4',section.stage),elem('pre',JSON.stringify(section.values,null,2),'lab-json'))}
   }else if(state.outputView==='Trace')renderTraceDebugger(resultBody,state,update);
   else resultBody.append(elem('pre',(state.diagnostics.map(d=>`${d.severity} ${d.code}: ${d.message}`).join('\n'))||'No diagnostics.','lab-json'));
   for(const message of localErrors)results.append(elem('p',message,'lab-message'));
 };
 return {render};
}
