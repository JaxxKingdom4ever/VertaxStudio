import type {SentenceLabState} from '../../../packages/sentence-lab/src/model.js';
import {buildTraceRows,buildScopeTree,openRequirements,inspectTraceValue,setBreakpoint,withTraceCursor} from '../../../packages/sentence-lab/src/index.js';
const elt=(tag:string,text:string,className?:string)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node};
export function renderTraceDebugger(container:HTMLElement,state:SentenceLabState,onChange:(state:SentenceLabState)=>void):void{
 container.replaceChildren();container.append(elt('h3','Trace Debugger'));
 const frames=state.result?.debugFrames??[];
 if(!frames.length){container.append(elt('p','Compile in trace mode to inspect node executions, scopes, Requirements, and values.'));return}
 const frameIndex=Math.min(state.traceCursor??0,frames.length-1),frame=frames[frameIndex]!;
 const timeline=elt('div','','trace-timeline');
 for(const row of buildTraceRows(frames,state.breakpoints)){
   const button=document.createElement('button');button.className=row.index===frameIndex?'trace-step selected':'trace-step';
   button.textContent=`${row.breakpoint?'● ':''}${row.index+1}. ${row.stage} · ${row.ruleId}`;
   button.title=row.reason;button.onclick=()=>onChange(withTraceCursor(state,row.index));timeline.append(button);
 }
 container.append(timeline);
 const nav=elt('div','','trace-navigation');const prev=document.createElement('button');prev.textContent='← Previous';prev.disabled=frameIndex===0;prev.onclick=()=>onChange(withTraceCursor(state,frameIndex-1));const next=document.createElement('button');next.textContent='Next →';next.disabled=frameIndex===frames.length-1;next.onclick=()=>onChange(withTraceCursor(state,frameIndex+1));nav.append(prev,elt('span',`${frameIndex+1} / ${frames.length}`),next);container.append(nav);
 const breakpointBox=elt('details','','trace-breakpoints');breakpointBox.append(elt('summary','Node breakpoints'));
 const nodes=[...new Set(frames.flatMap(f=>f.trace.nodeIds??[]))].sort();
 for(const id of nodes){const label=elt('label',id);const check=document.createElement('input');check.type='checkbox';check.checked=state.breakpoints.includes(id);check.onchange=()=>onChange(setBreakpoint(state,id,check.checked));label.prepend(check);breakpointBox.append(label)}
 container.append(breakpointBox);
 const phases=elt('div','','trace-phases');
 for(const phase of ['before','after'] as const){
   const snap=phase==='before'?frame.beforeState:frame.afterState;
   const section=elt('section','','trace-state');section.append(elt('h4',phase==='before'?'Before rule':'After rule'));
   section.append(elt('div',`Scope: ${snap.currentScopeId}`));
   const valueSelect=document.createElement('select');valueSelect.setAttribute('aria-label',`Inspect ${phase} value`);
   const ids=snap.values.map(v=>v.id);for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=id;valueSelect.append(option)}
   valueSelect.value=ids.includes(state.selectedValueId??'')?state.selectedValueId!:ids[0]??'';
   const inspected=elt('pre','','trace-json');
   const update=()=>{const value=inspectTraceValue(frame,phase,valueSelect.value);inspected.textContent=JSON.stringify(value??null,null,2)};
   valueSelect.onchange=update;section.append(valueSelect,inspected);update();
   const scopes=buildScopeTree(frame,phase);section.append(elt('h4','Scope tree'));
   const scopeArea=elt('pre',JSON.stringify(scopes,null,2),'trace-json');section.append(scopeArea);
   const requirements=snap.requirements;section.append(elt('h4',`Requirements · ${openRequirements(frame,phase).length} open`));section.append(elt('pre',JSON.stringify(requirements,null,2),'trace-json'));
   phases.append(section);
 }
 container.append(phases);
}
