import type {CompileResult} from '../../compiler/src/index.js';
import type {CompilerStage,StableId,SurfaceForm} from '../../core-types/src/index.js';
export interface GlossUnit {readonly id:StableId;readonly form:string;readonly kind:string;readonly features:Readonly<Record<string,unknown>>;readonly sourceIds:readonly StableId[];}
export interface StructureSection {readonly stage:CompilerStage;readonly values:readonly unknown[];}
export interface SurfaceTraceSpan {readonly start:number;readonly end:number;readonly text:string;readonly sourceIds:readonly StableId[];readonly nodeIds:readonly StableId[];}
export function buildGlossUnits(result:CompileResult):readonly GlossUnit[]{
 return (result.stageResults.Morphology?.values??[]).flatMap(value=>'morphs' in value?value.morphs.map(morph=>({id:morph.id,form:morph.kind==='Zero'?'∅':morph.form,kind:morph.kind,features:morph.features.values,sourceIds:morph.sourceObjectId?[morph.sourceObjectId]:[]})):[]);
}
export function buildStructureSections(result:CompileResult):readonly StructureSection[]{
 return (['Grammar','Morphology','Phonology','Surface'] as const).filter(stage=>result.stageResults[stage]).map(stage=>({stage,values:result.stageResults[stage]!.values}));
}
/** Preserve every code-unit offset through final concatenation, including unmatched delimiters and spaces. */
export function buildSurfaceTraceSpans(result:CompileResult):readonly SurfaceTraceSpan[]{
 const forms=(result.stageResults.Surface?.values??[]).filter((v):v is SurfaceForm=>'text' in v);
 const spans:SurfaceTraceSpan[]=[];let globalOffset=0;
 for(const [index,form] of forms.entries()){
   if(index){spans.push({start:globalOffset,end:globalOffset+1,text:' ',sourceIds:[],nodeIds:[]});globalOffset++;}
   if(form.segments && form.segments.map(segment=>segment.text).join('')===form.text){
     let local=0;
     for(const segment of form.segments){
       if(segment.text.length)spans.push({start:globalOffset+local,end:globalOffset+local+segment.text.length,text:segment.text,sourceIds:segment.sourceIds,nodeIds:segment.nodeIds});
       local+=segment.text.length;
     }
     globalOffset+=form.text.length;
     continue;
   }
   const mapped=Object.entries(form.sourceMap??{}).map(([offset,sources])=>({match:/^(\d+):(\d+)$/.exec(offset),sources})).filter(x=>x.match).map(({match,sources})=>({start:Number(match![1]),end:Number(match![2]),sources})).filter(x=>x.start>=0&&x.end<=form.text.length&&x.start<x.end).sort((a,b)=>a.start-b.start||a.end-b.end);
   let cursor=0;
   const push=(start:number,end:number,sources:readonly string[])=>{
     if(start>=end)return;
     spans.push({start:globalOffset+start,end:globalOffset+end,text:form.text.slice(start,end),sourceIds:sources,nodeIds:form.nodeSourceMap?.[`${start}:${end}`]??[]});
   };
   for(const m of mapped){if(m.start<cursor)continue;push(cursor,m.start,[]);push(m.start,m.end,m.sources);cursor=m.end;}
   push(cursor,form.text.length,[]);
   globalOffset+=form.text.length;
 }
 return spans;
}
