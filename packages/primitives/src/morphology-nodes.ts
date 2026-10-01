import type { AffixMorph, CompilerValue, Diagnostic, FeatureBundle, GrammarStructure, Morph, MorphSequence, RootMorph, SemanticObject, StableId, ZeroMorph } from "../../core-types/src/index.js";
import type { NodeContext, NodeRegistry } from "../../runtime/src/index.js";
import type { ProjectResources } from "./project-resources.js";

const emptyFeatures:FeatureBundle={values:{}};
export function rootMorph(form:string):RootMorph { return {id:`root:${form}`,kind:"Root",form,features:emptyFeatures}; }
export function prefixMorph(form:string):AffixMorph { return {id:`prefix:${form}`,kind:"Affix",position:"Prefix",form,features:emptyFeatures}; }
export function suffixMorph(form:string):AffixMorph { return {id:`suffix:${form}`,kind:"Affix",position:"Suffix",form,features:emptyFeatures}; }
export function zeroMorph(featureId:StableId):ZeroMorph { return {id:`zero:${featureId}`,kind:"Zero",featureId,features:emptyFeatures,realizationState:"Zero"}; }
export function realizeMorphs(morphs:readonly Morph[]):string { return morphs.map(m=>m.kind==="Zero"?"":m.form).join(""); }

const inputTypes=["MorphSequence"];
const semanticTypes=["Entity","Group","Event","State","Property","Relation","Quantity","Proposition","Unknown","Reference","Modality","SemanticList"];
const port=(id:string,acceptedTypes:readonly string[],direction:'input'|'output',required=true)=>({id,direction,acceptedTypes,cardinality:"ONE" as const,required});
const output=port('value',['MorphSequence'],'output');
const input=port('value',inputTypes,'input');
const diagnostic=(code:string,message:string):Diagnostic=>({severity:'Error',code,message});
const invalid=(code:string,message:string)=>({outputs:{value:[]},diagnostics:[diagnostic(code,message)]});
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const strings=(values:readonly (string|undefined)[]):string[]=>[...new Set(values.filter((v):v is string=>typeof v==='string'&&v.length>0))];
const addIds=(...parts:readonly (readonly (string|undefined)[])[]):string[]=>strings(parts.flat());
const suffix=(ctx:NodeContext,label:string)=>`${ctx.nodeId??'author'}:${label}`;
const sequence=(source:MorphSequence,ctx:NodeContext,label:string,morphs:readonly Morph[]):MorphSequence=>({id:`${source.id}:${suffix(ctx,label)}`,morphs});
const targetIndex=(sequence:MorphSequence,params:Readonly<Record<string,unknown>>):number|undefined=>{
  if(params.targetId!==undefined)return sequence.morphs.findIndex(m=>m.id===params.targetId);
  const index=params.targetIndex===undefined?sequence.morphs.findIndex(m=>m.kind!=="Zero"):params.targetIndex;
  return typeof index==='number'&&Number.isSafeInteger(index)&&index>=0&&index<sequence.morphs.length?index:undefined;
};
const target=(sequence:MorphSequence,params:Readonly<Record<string,unknown>>):{index:number,morph:Exclude<Morph,ZeroMorph>}|undefined=>{
  const index=targetIndex(sequence,params);
  if(index===undefined)return undefined;
  const morph=sequence.morphs[index];
  return morph&&morph.kind!=="Zero"?{index,morph}:undefined;
};
const replace=(source:MorphSequence,ctx:NodeContext,label:string,index:number,morph:Morph):MorphSequence=>sequence(source,ctx,label,source.morphs.map((value,i)=>i===index?morph:value));
const asFeatures=(value:unknown):FeatureBundle=>record(value)?{values:{...value}}:emptyFeatures;
const append=(source:MorphSequence,ctx:NodeContext,position:'Prefix'|'Suffix',params:Readonly<Record<string,unknown>>)=>{
  if(typeof params.form!=='string'||!params.form.length)return invalid('INVALID_MORPH_AFFIX','An affix requires a nonempty string form; use morph.zero for a zero realization.');
  const anchor=source.morphs.find(m=>m.kind!=='Zero');
  const origin=typeof params.sourceObjectId==='string'?params.sourceObjectId:undefined;
  const m:AffixMorph={id:`affix:${suffix(ctx,position)}`,kind:'Affix',position,form:params.form,features:params.features===undefined?(anchor?.features??emptyFeatures):asFeatures(params.features),boundaryBefore:typeof params.boundaryBefore==='string'?params.boundaryBefore:undefined,sourceObjectId:origin,sourceIds:origin?[origin]:[],realizationState:'Abstract'};
  return {outputs:{value:[sequence(source,ctx,position,position==='Prefix'?[m,...source.morphs]:[...source.morphs,m])]},diagnostics:[]};
};
interface Allomorph { readonly form:string; readonly when?:Readonly<Record<string,unknown>>; readonly priority?:number; readonly fallback?:boolean; }
const validAllomorph=(value:unknown):value is Allomorph=>record(value)&&typeof value.form==='string'&&
 (value.when===undefined||record(value.when))&&
 (value.priority===undefined||(typeof value.priority==='number'&&Number.isFinite(value.priority)))&&
 (value.fallback===undefined||typeof value.fallback==='boolean');
const choiceOrder=(a:Allomorph,b:Allomorph):number=>
 Object.keys(b.when??{}).length-Object.keys(a.when??{}).length || (b.priority??0)-(a.priority??0) || Number(a.fallback===true)-Number(b.fallback===true);
const equivalent=(a:Allomorph,b:Allomorph):boolean=>choiceOrder(a,b)===0;

export function registerMorphologyPrimitives(registry:NodeRegistry):void {
  registry.register({typeId:'morph.root',inputs:[port('value',['MorphCandidate'],'input')],outputs:[output],evaluate:(_ctx,inputs,params)=>{
    const candidate=inputs.value[0] as GrammarStructure;
    const form=params.form??candidate.data?.form;
    if(typeof form!=='string')return invalid('INVALID_ROOT_FORM','A root morph requires a string form.');
    const sourceObjectId=typeof candidate.data?.sourceObjectId==='string'?candidate.data.sourceObjectId:undefined;
    const morph:RootMorph={...rootMorph(form),id:`root:${candidate.id}`,features:candidate.features??emptyFeatures,sourceObjectId,sourceIds:addIds([candidate.id,sourceObjectId]),realizationState:'Abstract'};
    return {outputs:{value:[{id:`mseq:${candidate.id}:root`,morphs:[morph]}]},diagnostics:[]};
  }});
  for(const [id,position] of [['morph.prefix','Prefix'],['morph.suffix','Suffix']] as const)registry.register({typeId:id,inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>append(i.value[0] as MorphSequence,ctx,position,p)});
  registry.register({typeId:'morph.affix',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>p.position==='Prefix'||p.position==='Suffix'?append(i.value[0] as MorphSequence,ctx,p.position,p):invalid('INVALID_MORPH_AFFIX','Select Prefix or Suffix as the affix position.')});
  registry.register({typeId:'morph.circumfix',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>{
    if(typeof p.prefix!=='string'||!p.prefix.length||typeof p.suffix!=='string'||!p.suffix.length)return invalid('INVALID_MORPH_CIRCUMFIX','A circumfix needs nonempty prefix and suffix strings.');
    const source=i.value[0] as MorphSequence;
    const sharedId=`circumfix:${suffix(ctx,'pair')}`;
    const sourceObjectId=typeof p.sourceObjectId==='string'?p.sourceObjectId:undefined;
    const shared={features:p.features===undefined?(source.morphs.find(m=>m.kind!=='Zero')?.features??emptyFeatures):asFeatures(p.features),pairId:sharedId,sourceObjectId,sourceIds:sourceObjectId?[sourceObjectId]:[],realizationState:'Abstract' as const};
    const pre:AffixMorph={...shared,id:`${sharedId}:prefix`,kind:'Affix',position:'Prefix',form:p.prefix};
    const post:AffixMorph={...shared,id:`${sharedId}:suffix`,kind:'Affix',position:'Suffix',form:p.suffix};
    return {outputs:{value:[sequence(source,ctx,'circumfix',[pre,...source.morphs,post])]},diagnostics:[]};
  }});
  registry.register({typeId:'morph.zero',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>{
    if(typeof p.featureId!=='string'||!p.featureId)return invalid('INVALID_ZERO_MORPH','A zero morph requires featureId.');
    const source=i.value[0] as MorphSequence;
    const zero:ZeroMorph={...zeroMorph(p.featureId),id:`zero:${suffix(ctx,p.featureId)}`,features:asFeatures(p.features),sourceObjectId:typeof p.sourceObjectId==='string'?p.sourceObjectId:undefined};
    return {outputs:{value:[sequence(source,ctx,'zero',[...source.morphs,zero])]},diagnostics:[]};
  }});
  registry.register({typeId:'morph.select-allomorph',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>{
    const source=i.value[0] as MorphSequence;
    const found=target(source,p);
    if(!found)return invalid('INVALID_MORPH_TARGET','Allomorph selection requires a nonzero morph target.');
    const tableId=p.tableId;
    const resources=ctx.resources as ProjectResources|undefined;
    const table=typeof tableId==='string'?resources?.tables[tableId]:undefined;
    if(tableId!==undefined&&(!tableId||typeof tableId!=='string'||!table))return invalid('MISSING_ALLOMORPH_TABLE',`Allomorph table ${String(tableId)} is unavailable.`);
    const raw=table?table.rows:p.candidates;
    if(!Array.isArray(raw)||!raw.length||!raw.every(validAllomorph))return invalid('INVALID_ALLOMORPH_CANDIDATES','Allomorphs must be nonempty records with form:string, optional when/priority/fallback.');
    const matched=raw.filter((candidate:Allomorph)=>Object.entries(candidate.when??{}).every(([id,value])=>Object.is(found.morph.features.values[id],value))).sort(choiceOrder);
    if(!matched.length)return invalid('NO_MATCHING_ALLOMORPH','No candidate matches the morph features.');
    if(matched[1]&&equivalent(matched[0],matched[1]))return invalid('AMBIGUOUS_ALLOMORPH','Multiple equally specific, equally prioritized allomorphs match.');
    const selected=matched[0]!;
    const updated:Morph=selected.form===''?
      {id:found.morph.id,kind:'Zero',featureId:typeof p.featureId==='string'?p.featureId:'selected-zero',features:found.morph.features,sourceObjectId:found.morph.sourceObjectId,sourceIds:found.morph.sourceIds,meaningId:found.morph.meaningId,realizationState:'Zero'}:
      {...found.morph,form:selected.form,realizationState:'Selected'};
    return {outputs:{value:[replace(source,ctx,'allomorph',found.index,updated)]},diagnostics:[]};
  }});
  registry.register({typeId:'morph.order',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>{
    const source=i.value[0] as MorphSequence;
    const values=p.order;
    if(!Array.isArray(values)||values.length!==source.morphs.length||values.some(x=>typeof x!=='number'||!Number.isSafeInteger(x)||x<0||x>=source.morphs.length)||new Set(values).size!==values.length)
      return invalid('INVALID_MORPH_ORDER','Order must be a permutation of every morph index.');
    return {outputs:{value:[sequence(source,ctx,'order',values.map(index=>source.morphs[index]!))]},diagnostics:[]};
  }});
  registry.register({typeId:'morph.fuse',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>{
    const source=i.value[0] as MorphSequence;
    const start=p.start??0,count=p.count??2;
    if(typeof start!=='number'||!Number.isSafeInteger(start)||start<0||typeof count!=='number'||!Number.isSafeInteger(count)||count<2||start+count>source.morphs.length)
      return invalid('INVALID_MORPH_FUSION','Fusion needs a valid start and at least two contiguous morphs.');
    const group=source.morphs.slice(start,start+count);
    if(group.some(m=>m.kind==='Zero'))return invalid('ZERO_MORPH_FUSION','Zero morphs must stay inspectable and cannot be fused into a nonzero form.');
    if(p.form!==undefined&&typeof p.form!=='string')return invalid('INVALID_MORPH_FUSION','Fused form must be a string.');
    const [first,...rest]=group;
    const mergedFeatures:Record<string,unknown>={...first!.features.values};
    for(const member of rest)for(const [key,value] of Object.entries(member.features.values)){
      if(key in mergedFeatures&&!Object.is(mergedFeatures[key],value))return invalid('CONFLICTING_MORPH_FEATURES',`Cannot fuse conflicting feature ${key}.`);
      mergedFeatures[key]=value;
    }
    const ids=addIds(...group.map(m=>[m.id,...(m.sourceIds??[]),m.sourceObjectId]));
    const objects=group.map(m=>m.sourceObjectId).filter(Boolean);
    const fused:RootMorph={id:`fused:${suffix(ctx,String(start))}`,kind:'Root',form:(p.form??group.map(m=>m.kind==='Zero'?'':m.form).join('')) as string,features:{values:mergedFeatures},sourceIds:ids,sourceObjectId:objects.length===group.length&&objects.every(x=>x===objects[0])?objects[0]:undefined,realizationState:'Selected'};
    const all=[...source.morphs.slice(0,start),fused,...source.morphs.slice(start+count)];
    return {outputs:{value:[sequence(source,ctx,'fuse',all)]},diagnostics:[]};
  }});
  registry.register({typeId:'morph.reduplicate',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>{
    const source=i.value[0] as MorphSequence;const selected=target(source,p);
    if(!selected)return invalid('INVALID_MORPH_TARGET','Reduplication requires a nonzero source morph.');
    const mode=p.mode??'full',position=p.position??'Prefix';
    const count=p.length;
    if(!['full','partial'].includes(String(mode))||!['Prefix','Suffix'].includes(String(position))||(mode==='partial'&&(!Number.isSafeInteger(count)||Number(count)<1||Number(count)>[...selected.morph.form].length)))
      return invalid('INVALID_MORPH_REPLICATION','Reduplication requires full/partial mode, a side, and a valid partial length.');
    const form=mode==='full'?selected.morph.form:[...selected.morph.form].slice(0,Number(count)).join('');
    const copied:AffixMorph={id:`redup:${suffix(ctx,selected.morph.id)}`,kind:'Affix',position:position as 'Prefix'|'Suffix',form,features:selected.morph.features,sourceObjectId:selected.morph.sourceObjectId,sourceIds:addIds([selected.morph.id,...(selected.morph.sourceIds??[])]),realizationState:'Selected'};
    const values=[...source.morphs];values.splice(position==='Prefix'?selected.index:selected.index+1,0,copied);
    return {outputs:{value:[sequence(source,ctx,'reduplicate',values)]},diagnostics:[]};
  }});
  registry.register({typeId:'morph.mutate',inputs:[input],outputs:[output],evaluate:(ctx,i,p)=>{
    const source=i.value[0] as MorphSequence;const selected=target(source,p);
    if(!selected)return invalid('INVALID_MORPH_TARGET','Mutation requires a nonzero morph target.');
    if(typeof p.from!=='string'||!p.from||typeof p.to!=='string'||(p.all!==undefined&&typeof p.all!=='boolean'))return invalid('INVALID_MORPH_MUTATION','Mutation requires nonempty from, string to, optional all:boolean.');
    const form=p.all?selected.morph.form.split(p.from).join(p.to):selected.morph.form.replace(p.from,p.to);
    return {outputs:{value:[replace(source,ctx,'mutate',selected.index,{...selected.morph,form,realizationState:'Selected'})]},diagnostics:[]};
  }});
  registry.register({typeId:'morph.agreement',inputs:[input,port('controller',semanticTypes,'input',false)],outputs:[output],evaluate:(ctx,i,p)=>{
    const source=i.value[0] as MorphSequence;const selected=target(source,p);
    if(!selected)return invalid('INVALID_MORPH_TARGET','Agreement requires a nonzero morph target.');
    const controller=(i.controller?.[0]??(typeof p.controllerId==='string'?ctx.state.semanticGraph.objects[p.controllerId]:undefined)) as SemanticObject|undefined;
    if(!controller)return invalid('MISSING_AGREEMENT_CONTROLLER','Agreement requires a semantic controller or controllerId.');
    if(!record(p.features)||!Object.values(p.features).every(key=>typeof key==='string'))return invalid('INVALID_MORPH_AGREEMENT','Agreement features must map target names to controller feature names.');
    const updated={...selected.morph.features.values};
    for(const [targetKey,sourceKey] of Object.entries(p.features)){
      if(!(sourceKey as string in controller.features.values))return invalid('MISSING_AGREEMENT_FEATURE',`Controller lacks feature ${sourceKey as string}.`);
      updated[targetKey]=controller.features.values[sourceKey as string];
    }
    return {outputs:{value:[replace(source,ctx,'agreement',selected.index,{...selected.morph,features:{values:updated}})]},diagnostics:[]};
  }});
}
