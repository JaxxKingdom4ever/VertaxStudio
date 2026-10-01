import type {PhonologicalForm,PhonologicalToken} from '../../core-types/src/index.js';
import type {NodeRegistry,NodeEvaluation,PortDefinition} from '../../runtime/src/index.js';
import {matchingPhonemeIndices,adjacentPhoneme,type PhonologicalEnvironment} from './phonology-environment.js';
const input:PortDefinition={id:'value',direction:'input',acceptedTypes:['PhonologicalForm'],cardinality:'ONE',required:true};
const output:PortDefinition={id:'value',direction:'output',acceptedTypes:['PhonologicalForm'],cardinality:'ONE',required:true};
const optionalOutput:PortDefinition={...output,cardinality:'OPTIONAL',required:false};
const string=(value:unknown):string|undefined=>typeof value==='string'?value:undefined;
const record=(raw:unknown):Record<string,string>=>raw&&typeof raw==='object'&&!Array.isArray(raw)?Object.fromEntries(Object.entries(raw).filter((entry):entry is [string,string]=>typeof entry[1]==='string')):{};
const environment=(p:Readonly<Record<string,unknown>>):PhonologicalEnvironment=>({target:string(p.target),left:string(p.left),right:string(p.right),crossMorpheme:p.crossMorpheme===true,crossSyllable:p.crossSyllable===true,crossWord:p.crossWord===true});
const done=(input:PhonologicalForm,tokens:readonly PhonologicalToken[]):NodeEvaluation=>({outputs:{value:[{...input,tokens}]},diagnostics:[]});
const one=(input:PhonologicalForm):NodeEvaluation=>({outputs:{value:[input]},diagnostics:[]});
const fail=(code:string,message:string):NodeEvaluation=>({outputs:{},diagnostics:[{severity:'Error',code,message}]});
const matched=(input:PhonologicalForm,params:Readonly<Record<string,unknown>>)=>matchingPhonemeIndices(input.tokens,environment(params));
function rewrite(input:PhonologicalForm,indices:readonly number[],replacement:string):NodeEvaluation{
 if(!indices.length)return one(input);
 const matched=new Set(indices);
 const tokens=input.tokens.flatMap((token,i):PhonologicalToken[]=>matched.has(i)&&token.kind==='Phoneme'
  ?[...replacement].map(symbol=>({...token,symbol})):[token]);
 return done(input,tokens);
}
export function registerPhonologicalRulePrimitives(registry:NodeRegistry):void {
 registry.register({typeId:'phon.environment-match',inputs:[input],outputs:[optionalOutput],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;
   return {outputs:{value:matched(value,p).length?[value]:[]},diagnostics:[]};
 }});
 registry.register({typeId:'phon.replace',inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;
   if(typeof p.target!=='string'||!p.target||typeof p.replaceWith!=='string')return fail('INVALID_PHONOLOGY_PARAMETER','Replace requires target and replaceWith strings.');
   return rewrite(value,matched(value,p),p.replaceWith);
 }});
 registry.register({typeId:'phon.delete',inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   if(typeof p.target!=='string'||!p.target)return fail('INVALID_PHONOLOGY_PARAMETER','Delete requires a nonempty target phoneme.');
   return rewrite(i.value[0] as PhonologicalForm,matched(i.value[0] as PhonologicalForm,p),'');
 }});
 registry.register({typeId:'phon.insert',inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;
   if(typeof p.target!=='string'||!p.target||typeof p.insert!=='string'||!['before','after'].includes(String(p.position??'after')))return fail('INVALID_PHONOLOGY_PARAMETER','Insert requires insert string and position before/after.');
   const where=new Set(matched(value,p));
   const tokens=value.tokens.flatMap((token,index):PhonologicalToken[]=>{
     if(!where.has(index)||token.kind!=='Phoneme')return [token];
     const insert=[...p.insert as string].map(symbol=>({kind:'Phoneme' as const,symbol,sourceMorphId:token.sourceMorphId,sourceObjectId:token.sourceObjectId}));
     return p.position==='before'?[...insert,token]:[token,...insert];
   });
   return done(value,tokens);
 }});
 registry.register({typeId:'phon.metathesize',inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;
   if(typeof p.left!=='string'||typeof p.right!=='string')return fail('INVALID_PHONOLOGY_PARAMETER','Metathesis requires left/right phonemes.');
   const env=environment(p);
   const tokens=[...value.tokens];const used=new Set<number>();
   for(let index=0;index<tokens.length;index++){
     const token=tokens[index];if(token?.kind!=='Phoneme'||token.symbol!==p.left||used.has(index))continue;
     if(adjacentPhoneme(tokens,index,1,env)!==p.right)continue;
     const other=matchingPhonemeIndices(tokens,{...env,target:p.right,left:p.left,right:undefined}).find(j=>j>index&&!used.has(j));
     if(other===undefined)continue;
     [tokens[index],tokens[other]]=[tokens[other]!,tokens[index]!];used.add(index);used.add(other);
   }
   return done(value,tokens);
 }});
 registry.register({typeId:'phon.assimilate',inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;const mapping=record(p.mapping);
   const indices=matched(value,p);
   const tokens=value.tokens.map((token,index)=>{
     if(token.kind!=='Phoneme'||!indices.includes(index))return token;
     const neighbor=adjacentPhoneme(value.tokens,index,p.direction==='left'?-1:1,environment(p));
     return {...token,symbol:mapping[`${token.symbol}:${neighbor??''}`]??token.symbol};
   });
   return done(value,tokens);
 }});
 registry.register({typeId:'phon.stress',inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;const level=p.level==='Secondary'?'Secondary':'Primary';const indices=matched(value,p);
   const first=indices[0];if(first===undefined)return one(value);
   const tokens=[...value.tokens];const source=tokens[first];tokens.splice(first,0,{kind:'Stress',level,sourceMorphId:source?.sourceMorphId});
   return done(value,tokens);
 }});
 registry.register({typeId:'phon.syllabify',inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;
   const before=Array.isArray(p.beforeSymbols)?p.beforeSymbols.filter((x):x is string=>typeof x==='string'):[];
   const tokens:PhonologicalToken[]=[];
   for(const token of value.tokens){
     if(token.kind==='Phoneme'&&before.includes(token.symbol)&&tokens.some(t=>t.kind==='Phoneme'))tokens.push({kind:'Boundary',boundary:'Syllable',sourceMorphId:token.sourceMorphId});
     tokens.push(token);
   }
   return done(value,tokens);
 }});
 for(const type of ['harmony','lenition','fortition'] as const)registry.register({typeId:`phon.${type}`,inputs:[input],outputs:[output],evaluate:(_c,i,p)=>{
   const value=i.value[0] as PhonologicalForm;
   const mapping=record(p.mapping);
   const trigger=string(p.trigger);
   const tokens=value.tokens.map((token,index)=>{
     if(token.kind!=='Phoneme'||!(token.symbol in mapping))return token;
     if(trigger!==undefined){
       // A trigger only affects subsequent tokens inside the same word by default.
       const prefix=value.tokens.slice(0,index);
       let boundaryIndex=-1;for(let j=prefix.length-1;j>=0;j--){const t=prefix[j];if(t?.kind==='Boundary'&&t.boundary==='Word'){boundaryIndex=j;break;}}
       if(!prefix.slice(boundaryIndex+1).some(t=>t.kind==='Phoneme'&&t.symbol===trigger))return token;
     }
     return {...token,symbol:mapping[token.symbol]!};
   });
   return done(value,tokens);
 }});
}
