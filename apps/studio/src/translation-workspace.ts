import type {LoadedVertaxProject} from '../../../packages/project-model/src/model.js';
import type {Diagnostic,SemanticGraph} from '../../../packages/core-types/src/index.js';

export interface PackCatalogEntry {readonly id:string;readonly path:string;readonly capabilities:readonly ('generate'|'analyze')[];}
export interface TranslationViewResult {readonly success:boolean;readonly needsSelection:boolean;readonly candidates:readonly {id:string;meaning:SemanticGraph}[];readonly surface?:string;readonly diagnostics:readonly Diagnostic[];}
export function pickLanguagePacks(entries:readonly PackCatalogEntry[]):{sources:readonly PackCatalogEntry[];targets:readonly PackCatalogEntry[]}{
 return {sources:entries.filter(p=>p.capabilities.includes('analyze')),targets:entries.filter(p=>p.capabilities.includes('generate'))};
}
export function translationView(result:TranslationViewResult):{surface?:string;requiresSelection:boolean;candidates:readonly {id:string;meaning:SemanticGraph}[];diagnostics:readonly Diagnostic[]}{
 return {surface:result.needsSelection?undefined:result.surface,requiresSelection:result.needsSelection,candidates:result.candidates,diagnostics:result.diagnostics};
}
const button=(label:string,onClick:()=>void)=>{const el=document.createElement('button');el.type='button';el.textContent=label;el.onclick=onClick;return el};
const heading=(label:string)=>{const h=document.createElement('h2');h.textContent=label;return h};

/** Browser-only view. The server is the exclusive authority for local pack paths. */
export function mountTranslationWorkspace(container:HTMLElement,onOpenPack:(project:LoadedVertaxProject)=>void):void{
  container.replaceChildren();
  const top=document.createElement('div');top.className='translation-header';top.append(heading('Analysis / Translation'));
  const subtitle=document.createElement('p');subtitle.textContent='Source text → confirmed MeaningGraph → target language. Ambiguous source meanings require a choice.';top.append(subtitle);container.append(top);
  const selectors=document.createElement('div');selectors.className='translation-selectors';container.append(selectors);
  const sourceLabel=document.createElement('label');sourceLabel.textContent='Source language';const source=document.createElement('select');source.setAttribute('aria-label','Source language');sourceLabel.append(source);
  const targetLabel=document.createElement('label');targetLabel.textContent='Target language';const target=document.createElement('select');target.setAttribute('aria-label','Target language');targetLabel.append(target);
  selectors.append(sourceLabel,targetLabel);
  const sourceText=document.createElement('textarea');sourceText.placeholder='Enter a sentence within the pack’s supported grammar…';sourceText.rows=3;sourceText.setAttribute('aria-label','Source sentence');container.append(sourceText);
  const actions=document.createElement('div');actions.className='translation-actions';container.append(actions);
  const resultPanel=document.createElement('section');resultPanel.className='translation-result';container.append(resultPanel);
  const status=document.createElement('p');status.className='translation-status';resultPanel.append(status);
  const output=document.createElement('pre');output.className='translation-surface';resultPanel.append(output);
  const candidatesPanel=document.createElement('div');candidatesPanel.className='translation-candidates';resultPanel.append(candidatesPanel);
  const meaningPanel=document.createElement('pre');meaningPanel.className='translation-meaning';resultPanel.append(meaningPanel);
  const analyzeButton=button('Analyze only',()=>void run(undefined,'analyze'));
  const runButton=button('Analyze and translate',()=>void run());actions.append(analyzeButton,runButton);
  const openSource=button('Open source pack in Graph Studio',()=>void open(source.value));const openTarget=button('Open target pack in Graph Studio',()=>void open(target.value));actions.append(openSource,openTarget);
  let requestNumber=0;
  const run=async(candidateId?:string,operation:'analyze'|'translate'='translate')=>{
    const ticket=++requestNumber;status.textContent='Analyzing…';output.textContent='';candidatesPanel.replaceChildren();meaningPanel.textContent='';
    try{
      const endpoint=operation==='analyze'?'/api/analyze':'/api/translation';
      const request=operation==='analyze'?{sourcePack:source.value,text:sourceText.value}:{sourcePack:source.value,targetPack:target.value,text:sourceText.value,...(candidateId?{candidateId}:{})};
      const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});
      const raw=await response.json() as TranslationViewResult;
      if(ticket!==requestNumber)return;
      const result=translationView(raw);
      const message=result.diagnostics.map(x=>`${x.code}: ${x.message}`).join('\n');
      status.textContent=operation==='analyze'
        ? raw.success?(result.candidates.length===1?'Analysis completed.':`${result.candidates.length} meanings found.`):message||`Analysis failed (${response.status}).`
        :result.requiresSelection?'Choose one of the meanings below.':raw.success?'Translation generated.':message||`Translation failed (${response.status}).`;
      output.textContent=result.surface??'';
      if(result.candidates.length){
        const heading=document.createElement('h3');heading.textContent=result.candidates.length===1?'Confirmed semantic graph':'Interpretation candidates';candidatesPanel.append(heading);
        for(const c of result.candidates){
          const candidateButton=button(`Interpretation ${c.id}`,()=>{meaningPanel.textContent=JSON.stringify(c.meaning,null,2);if(operation==='translate'&&result.requiresSelection)void run(c.id)});
          candidatesPanel.append(candidateButton);
        }
        if(result.candidates.length===1)meaningPanel.textContent=JSON.stringify(result.candidates[0]?.meaning,null,2);
      }
      if(message&&!raw.success){const err=document.createElement('pre');err.className='translation-errors';err.textContent=message;candidatesPanel.append(err)}
    }catch(err){if(ticket===requestNumber)status.textContent=`Translation endpoint unavailable: ${err instanceof Error?err.message:String(err)}`}
  };
  const open=async(id:string)=>{
    try{const res=await fetch(`/api/language-packs/${encodeURIComponent(id)}`);if(!res.ok)throw new Error(`HTTP ${res.status}`);const data=await res.json() as {project:LoadedVertaxProject};onOpenPack(data.project)}
    catch(err){status.textContent=`Could not open language pack: ${err instanceof Error?err.message:String(err)}`}
  };
  void fetch('/api/language-packs').then(r=>r.json()).then((all:PackCatalogEntry[])=>{
    const choices=pickLanguagePacks(all);
    for(const [el,entries] of [[source,choices.sources],[target,choices.targets]] as const){
      el.replaceChildren();for(const item of entries){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.id;el.append(opt)}
    }
    if(!choices.sources.length||!choices.targets.length){analyzeButton.disabled=!choices.sources.length;runButton.disabled=!choices.sources.length||!choices.targets.length;status.textContent='No compatible language packs are installed.'}
    else{sourceText.value='The person cooks the food.';status.textContent='Choose languages and analyze a source sentence.'}
  }).catch(err=>{analyzeButton.disabled=true;runButton.disabled=true;status.textContent=`Language-pack catalog unavailable: ${err instanceof Error?err.message:String(err)}`});
}
