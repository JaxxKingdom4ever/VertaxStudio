import type {CompilerValue,Morph,SurfaceForm,SurfaceSegment} from '../../core-types/src/index.js';
import type {NodeRegistry} from '../../runtime/src/index.js';
import {rewriteSurface,surfaceFromSegments,surfaceSegments} from './surface-form.js';
const asForm=(value:CompilerValue,separator:string,nodeId?:string):SurfaceForm=>{
 if('text' in value)return surfaceFromSegments(value.id,surfaceSegments(value));
 const segments:SurfaceSegment[]=[];
 if('morphs' in value){
   let first=true;
   for(const morph of value.morphs){
     if(morph.kind==='Zero')continue;
     const between=first?'':(morph.boundaryBefore??separator);
     if(between)segments.push({kind:'Boundary',text:between,sourceIds:[morph.id],nodeIds:nodeId?[nodeId]:[]});
     segments.push({kind:'Grapheme',text:morph.form,sourceIds:[morph.id,...(morph.sourceObjectId?[morph.sourceObjectId]:[])],nodeIds:nodeId?[nodeId]:[]});
     first=false;
   }
 }else if('kind' in value&&value.kind==='BoundUnit'){
   const parts=value.data?.parts;
   if(Array.isArray(parts))parts.forEach((part,index)=>{
     if(index&&separator)segments.push({kind:'Boundary',text:separator,sourceIds:[value.id],nodeIds:nodeId?[nodeId]:[]});
     segments.push({kind:'Grapheme',text:String(part),sourceIds:[value.id],nodeIds:nodeId?[nodeId]:[]});
   });
 }
 return surfaceFromSegments(`surface:${value.id}`,segments);
};
const inPort=(name:string,types:string[],cardinality:'ONE'|'MANY'='ONE')=>({id:name,direction:'input' as const,acceptedTypes:types,cardinality,required:true});
const outPort={id:'value',direction:'output' as const,acceptedTypes:['SurfaceForm'],cardinality:'ONE' as const,required:true};
export function registerSurfacePrimitives(registry:NodeRegistry):void {
 registry.register({typeId:'surface.join',inputs:[inPort('value',['MorphSequence','BoundUnit','SurfaceForm'])],outputs:[outPort],evaluate:(ctx,i,p)=>({outputs:{value:[asForm(i.value[0]!,String(p.separator??''),ctx.nodeId)]},diagnostics:[]})});
 registry.register({typeId:'surface.space',inputs:[inPort('values',['SurfaceForm'],'MANY')],outputs:[outPort],evaluate:(ctx,i)=>{
   const segments:SurfaceSegment[]=[];
   for(const [index,value] of i.values.entries()){
     if(index)segments.push({kind:'Space',text:' ',sourceIds:[],nodeIds:ctx.nodeId?[ctx.nodeId]:[]});
     segments.push(...surfaceSegments(value as SurfaceForm));
   }
   return {outputs:{value:[surfaceFromSegments(`surface:space:${i.values.map(v=>v.id).join(':')}`,segments)]},diagnostics:[]};
 }});
 registry.register({typeId:'surface.capitalize',inputs:[inPort('value',['SurfaceForm'])],outputs:[outPort],evaluate:(ctx,i,p)=>{
   const value=i.value[0] as SurfaceForm;const segments=surfaceSegments(value).map(seg=>({...seg,nodeIds:ctx.nodeId?[...seg.nodeIds,ctx.nodeId]:seg.nodeIds}));
   const style=p.style==='upper'?'upper':p.style==='lower'?'lower':'sentence';
   if(style==='upper'||style==='lower')for(let index=0;index<segments.length;index++)segments[index]={...segments[index]!,text:style==='upper'?segments[index]!.text.toUpperCase():segments[index]!.text.toLowerCase()};
   else{const first=segments.findIndex(seg=>seg.text.trim().length>0);if(first>=0)segments[first]={...segments[first]!,text:segments[first]!.text.charAt(0).toUpperCase()+segments[first]!.text.slice(1)}}
   return {outputs:{value:[surfaceFromSegments(value.id,segments)]},diagnostics:[]};
 }});
 registry.register({typeId:'surface.punctuate',inputs:[inPort('value',['SurfaceForm'])],outputs:[outPort],evaluate:(ctx,i,p)=>{
   const value=i.value[0] as SurfaceForm;
   const prefix=typeof p.prefix==='string'?p.prefix:'';
   const suffix=typeof p.suffix==='string'?p.suffix:'';
   const punctuation=(text:string):SurfaceSegment=>({kind:'Punctuation',text,sourceIds:[],nodeIds:ctx.nodeId?[ctx.nodeId]:[]});
   const result=surfaceFromSegments(value.id,[...(prefix?[punctuation(prefix)]:[]),...surfaceSegments(value),...(suffix?[punctuation(suffix)]:[])]);
   return {outputs:{value:[result]},diagnostics:[]};
 }});
 registry.register({typeId:'surface.rewrite',inputs:[inPort('value',['SurfaceForm'])],outputs:[outPort],evaluate:(ctx,i,p)=>{
   if(typeof p.from!=='string'||!p.from.length||typeof p.to!=='string')return {outputs:{value:[]},diagnostics:[{severity:'Error',code:'INVALID_SURFACE_REWRITE',message:'Rewrite requires nonempty from and string to.'}]};
   const value=i.value[0] as SurfaceForm;
   return {outputs:{value:[rewriteSurface(value,p.from,p.to,ctx.nodeId)]},diagnostics:[]};
 }});
 registry.register({typeId:'surface.output',inputs:[inPort('value',['SurfaceForm'])],outputs:[outPort],evaluate:(_c,i)=>({outputs:{value:i.value},diagnostics:[]})});
}
