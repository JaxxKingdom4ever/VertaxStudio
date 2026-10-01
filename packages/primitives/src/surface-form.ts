import type {PhonologicalForm,SurfaceForm,SurfaceSegment,StableId} from '../../core-types/src/index.js';
import type {ProjectResources} from './project-resources.js';
const unique=(ids:readonly StableId[]):readonly StableId[]=>[...new Set(ids)];
export function surfaceFromSegments(id:StableId,segments:readonly SurfaceSegment[]):SurfaceForm{
  const sourceMap:Record<string,readonly StableId[]>={};const nodeSourceMap:Record<string,readonly StableId[]>={};
  let offset=0;
  for(const segment of segments){
    if(segment.text.length){
      const key=`${offset}:${offset+segment.text.length}`;
      if(segment.sourceIds.length)sourceMap[key]=unique(segment.sourceIds);
      if(segment.nodeIds.length)nodeSourceMap[key]=unique(segment.nodeIds);
    }
    offset+=segment.text.length;
  }
  return {id,text:segments.map(s=>s.text).join(''),sourceMap,nodeSourceMap,segments};
}
export function surfaceSegments(form:SurfaceForm):readonly SurfaceSegment[]{
 if(form.segments)return form.segments;
 const positions=Array.from({length:form.text.length},(_,index)=>({text:form.text[index]!,kind:'Grapheme' as const,sourceIds:[] as string[],nodeIds:[] as string[]}));
 for(const [span,ids] of Object.entries(form.sourceMap??{})){
   const match=/^(\d+):(\d+)$/.exec(span);if(!match)continue;
   for(let offset=Number(match[1]);offset<Math.min(form.text.length,Number(match[2]));offset++)if(positions[offset])positions[offset]!.sourceIds=[...ids];
 }
 for(const [span,ids] of Object.entries(form.nodeSourceMap??{})){
   const match=/^(\d+):(\d+)$/.exec(span);if(!match)continue;
   for(let offset=Number(match[1]);offset<Math.min(form.text.length,Number(match[2]));offset++)if(positions[offset])positions[offset]!.nodeIds=[...ids];
 }
 return positions;
}
export function rewriteSurface(form:SurfaceForm,from:string,to:string,nodeId?:StableId):SurfaceForm{
 if(!from)return form;
 // Source-map spans use JS UTF-16 code-unit offsets, not Unicode codepoint indices.
 const chars=surfaceSegments(form).flatMap(seg=>seg.text.split('').map(char=>({...seg,text:char})));
 const text=form.text;const out:SurfaceSegment[]=[];let at=0;
 while(at<text.length){
   if(text.startsWith(from,at)){
     const affected=chars.slice(at,at+from.length);
     out.push({kind:'Grapheme',text:to,sourceIds:unique(affected.flatMap(s=>s.sourceIds)),nodeIds:unique([...affected.flatMap(s=>s.nodeIds),...(nodeId?[nodeId]:[])])});
     at+=from.length;
   }else{out.push(chars[at]??{kind:'Grapheme',text:text[at]!,sourceIds:[],nodeIds:[]});at++;}
 }
 return surfaceFromSegments(form.id,out);
}
export function spellPhonologicalForm(phon:PhonologicalForm,resources:ProjectResources|undefined,params:Readonly<Record<string,unknown>>,nodeId?:StableId):{value?:SurfaceForm;error?:string}{
 const tableId=typeof params.tableId==='string'?params.tableId:undefined;
 const table=tableId?resources?.tables[tableId]:undefined;
 if(tableId&&!table)return {error:`Missing spelling table ${tableId}.`};
 const lookup=new Map<string,string>();
 for(const row of table?.rows??[]){if(typeof row.phoneme==='string'&&typeof row.grapheme==='string')lookup.set(row.phoneme,row.grapheme)}
 const boundaries=params.boundaries&&typeof params.boundaries==='object'&&!Array.isArray(params.boundaries)?params.boundaries as Record<string,unknown>:{};
 const segments:SurfaceSegment[]=[];
 for(const token of phon.tokens){
   let text='';let kind:SurfaceSegment['kind']='Grapheme';
   if(token.kind==='Phoneme'){
     const mapped=lookup.get(token.symbol);
     if(tableId && mapped===undefined && params.unmapped!=='preserve')return {error:`Unmapped phoneme ${token.symbol} in ${tableId}.`};
     text=mapped??token.symbol;
   }else if(token.kind==='Boundary'){
     const replacement=boundaries[token.boundary];text=typeof replacement==='string'?replacement:'';
     kind=token.boundary==='Word'?'Space':'Boundary';
   }else{
     text=typeof params.stress==='object'&&params.stress!==null?String((params.stress as Record<string,unknown>)[token.level]??''):'';
     kind='Boundary';
   }
   if(text)segments.push({text,kind,sourceIds:unique([token.sourceMorphId,...(token.kind==='Phoneme'?[token.sourceObjectId]:[])].filter((x):x is string=>!!x)),nodeIds:nodeId?[nodeId]:[]});
 }
 return {value:surfaceFromSegments(`surface:${phon.id}`,segments)};
}
