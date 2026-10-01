import type { AffixMorph, Morph, RootMorph, StableId, ZeroMorph } from "../../core-types/src/index.js";
import type { NodeRegistry } from "../../runtime/src/index.js";

const emptyFeatures={values:{}} as const;
export function rootMorph(form:string):RootMorph { return {id:`root:${form}`,kind:"Root",form,features:emptyFeatures}; }
export function prefixMorph(form:string):AffixMorph { return {id:`prefix:${form}`,kind:"Affix",position:"Prefix",form,features:emptyFeatures}; }
export function suffixMorph(form:string):AffixMorph { return {id:`suffix:${form}`,kind:"Affix",position:"Suffix",form,features:emptyFeatures}; }
export function zeroMorph(featureId:StableId):ZeroMorph { return {id:`zero:${featureId}`,kind:"Zero",featureId,features:emptyFeatures}; }
export function realizeMorphs(morphs:readonly Morph[]):string { return morphs.map(m=>m.kind==="Zero"?"":m.form).join(""); }

export function registerMorphologyPrimitives(registry:NodeRegistry):void {
  const input=(acceptedTypes:readonly string[])=>({id:"value",direction:"input" as const,acceptedTypes,cardinality:"ONE" as const,required:true});
  const output=()=>({id:"value",direction:"output" as const,acceptedTypes:["MorphSequence"],cardinality:"ONE" as const,required:true});
  registry.register({typeId:"morph.root",inputs:[input(["MorphCandidate"])],outputs:[output()],evaluate:(_c,i,p)=>{
    const source=i.value[0]!; const form=String(p.form ?? ("data" in source ? source.data?.form ?? "" : ""));
    return {outputs:{value:[{id:`mseq:${source.id}:root`,morphs:[rootMorph(form)]}]},diagnostics:[]};
  }});
  for (const [typeId,kind] of [["morph.prefix","prefix"],["morph.suffix","suffix"]] as const) registry.register({typeId,inputs:[input(["MorphSequence"])],outputs:[output()],evaluate:(_c,i,p)=>{
    const seq=i.value[0] as {id:string;morphs:readonly Morph[]}; const m=kind==="prefix"?prefixMorph(String(p.form??"")):suffixMorph(String(p.form??""));
    return {outputs:{value:[{id:`${seq.id}:${typeId}`,morphs:kind==="prefix"?[m,...seq.morphs]:[...seq.morphs,m]}]},diagnostics:[]};
  }});
  registry.register({typeId:"morph.zero",inputs:[input(["MorphSequence"])],outputs:[output()],evaluate:(_c,i,p)=>{
    const seq=i.value[0] as {id:string;morphs:readonly Morph[]}; const z=zeroMorph(String(p.featureId??"zero"));
    return {outputs:{value:[{id:`${seq.id}:zero`,morphs:[...seq.morphs,z]}]},diagnostics:[]};
  }});
}
