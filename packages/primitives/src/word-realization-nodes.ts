import type { CompilerValue, Diagnostic, GrammarStructure, SemanticObject } from "../../core-types/src/index.js";
import { closeScope, openRequirement, openScope, resolveRequirement, type NodeRegistry, type RuntimeState } from "../../runtime/src/index.js";
import { findLexemeByConcept } from "./lexicon.js";
import type { ProjectResources } from "./project-resources.js";

type MorphKind = "Root" | "Prefix" | "Suffix" | "Zero";
interface WordFragment {
  readonly role?: string;
  readonly root?: boolean;
  readonly conceptId?: string;
  readonly featureId?: string;
  readonly kind?: MorphKind;
  readonly formKey?: string;
  readonly lexicalClass?: string;
  readonly joinBefore?: string;
}
/** A project-authored recursive expansion of one or more semantic role targets. */
interface RoleExpansion {
  readonly expandRole: string;
  readonly separatorWords?: readonly (readonly WordFragment[])[];
  /** Project-authored morphs conjoined to the next member in a list tail. */
  readonly prefix?: readonly WordFragment[];
  /** Orthographic boundary between the prefix and the next emitted member. */
  readonly prefixBoundary?: string;
  readonly minItems?: number;
  /** Lexical fragments attached to the final word emitted by this expansion. */
  readonly suffix?: readonly WordFragment[];
  /** Open a nested scope and resolve a typed Requirement when the child returns. */
  readonly scopeType?: string;
  readonly acceptedTypes?: readonly string[];
  /** Semantic features required on each target; authored data, not a language hook. */
  readonly requiredFeatures?: Readonly<Record<string, unknown>>;
}
type WordPiece = readonly WordFragment[] | RoleExpansion;
interface WordPattern {
  readonly id: string;
  readonly conceptId: string;
  readonly valueTypes?: readonly string[];
  readonly features?: Readonly<Record<string, unknown>>;
  readonly roleTypes?: Readonly<Record<string, string>>;
  readonly roleConcepts?: Readonly<Record<string, string>>;
  readonly requiredRoles?: readonly string[];
  readonly priority?: number;
  readonly words: readonly WordPiece[];
}
interface LexicalSegment {
  readonly lexemeId?: string;
  readonly formKey?: string;
  readonly featureId?: string;
  readonly kind: MorphKind;
  readonly joinBefore?: string;
  readonly sourceId?: string;
}
const err=(code:string,message:string,objectId?:string):Diagnostic=>({severity:"Error",code,message,objectId});
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const strs=(v:unknown):v is readonly string[]=>Array.isArray(v)&&v.every(x=>typeof x==="string");
function fragment(v:unknown):v is WordFragment {
  if(!rec(v))return false;
  if(v.kind!==undefined&&!(["Root","Prefix","Suffix","Zero"] as unknown[]).includes(v.kind))return false;
  if(v.root!==undefined&&typeof v.root!=="boolean")return false;
  for(const k of ["role","conceptId","featureId","formKey","lexicalClass","joinBefore"])if(v[k]!==undefined&&typeof v[k]!=="string")return false;
  const selectors=[v.root===true,v.role!==undefined,v.conceptId!==undefined,v.featureId!==undefined];
  return selectors.filter(Boolean).length===1 && (v.kind!=="Zero"||typeof v.featureId==="string");
}
const expansion=(v:unknown):v is RoleExpansion=>rec(v)&&typeof v.expandRole==="string"&&v.expandRole.length>0&&
  (v.separatorWords===undefined||(Array.isArray(v.separatorWords)&&v.separatorWords.every(w=>Array.isArray(w)&&w.length>0&&w.every(fragment))))&&
  (v.suffix===undefined||(Array.isArray(v.suffix)&&v.suffix.length>0&&v.suffix.every(fragment)))&&
  (v.prefix===undefined||(Array.isArray(v.prefix)&&v.prefix.length>0&&v.prefix.every(fragment)))&&
  (v.prefixBoundary===undefined||typeof v.prefixBoundary==="string")&&
  (v.minItems===undefined||(Number.isSafeInteger(v.minItems)&&Number(v.minItems)>=1))&&
  (v.scopeType===undefined||(typeof v.scopeType==="string"&&v.scopeType.length>0))&&
  (v.acceptedTypes===undefined||(strs(v.acceptedTypes)&&v.acceptedTypes.length>0))&&
  (v.requiredFeatures===undefined||rec(v.requiredFeatures))&&
  (v.scopeType!==undefined||v.acceptedTypes===undefined);
const isExpansion=(p:WordPiece):p is RoleExpansion=>!Array.isArray(p);
function validPattern(v:unknown):v is WordPattern {
  return rec(v)&&typeof v.id==="string"&&typeof v.conceptId==="string"&&Array.isArray(v.words)&&v.words.length>0&&
    v.words.every(x=>Array.isArray(x)?x.length>0&&x.every(fragment):expansion(x))&&
    (v.features===undefined||rec(v.features))&&
    (v.valueTypes===undefined||(strs(v.valueTypes)&&v.valueTypes.length>0))&&
    (v.roleTypes===undefined||(rec(v.roleTypes)&&Object.values(v.roleTypes).every(x=>typeof x==="string")))&&
    (v.roleConcepts===undefined||(rec(v.roleConcepts)&&Object.values(v.roleConcepts).every(x=>typeof x==="string")))&&
    (v.requiredRoles===undefined||strs(v.requiredRoles))&&
    (v.priority===undefined||typeof v.priority==="number"&&Number.isFinite(v.priority));
}
function matches(p:WordPattern, value:SemanticObject, objects:Readonly<Record<string,SemanticObject>>):boolean {
  if(p.conceptId!=="*"&&p.conceptId!==value.conceptId)return false;
  if(p.valueTypes&&!p.valueTypes.includes(value.type))return false;
  if(!Object.entries(p.features??{}).every(([name,expected])=>Object.is(value.features.values[name],expected)))return false;
  const fragmentRoles=(fragments:readonly WordFragment[]|undefined):string[]=>fragments?.flatMap(s=>s.role?[s.role]:[])??[];
  const expansionRoles=p.words.flatMap(w=>isExpansion(w)?[
    w.expandRole,...fragmentRoles(w.prefix),...fragmentRoles(w.suffix),
    ...(w.separatorWords??[]).flatMap(fragmentRoles)
  ]:fragmentRoles(w));
  const usedRoles=new Set([...(p.requiredRoles??[]),...Object.keys(p.roleTypes??{}),...Object.keys(p.roleConcepts??{}),...expansionRoles]);
  if(![...usedRoles].every(role=>(value.roles[role]?.length??0)>0))return false;
  if(!Object.entries(value.roles).every(([role,targets])=>targets.length===0||usedRoles.has(role)))return false;
  for(const [role,expected] of Object.entries(p.roleTypes??{}))if(objects[value.roles[role]![0]!]?.type!==expected)return false;
  for(const [role,expected] of Object.entries(p.roleConcepts??{}))if(objects[value.roles[role]![0]!]?.conceptId!==expected)return false;
  return true;
}
function score(p:WordPattern):number {
  return (p.conceptId==="*"?0:100)+(p.valueTypes?1/p.valueTypes.length:0)+Object.keys(p.features??{}).length+Object.keys(p.roleTypes??{}).length+Object.keys(p.roleConcepts??{}).length;
}
function realize(
  value: SemanticObject,
  objects: Readonly<Record<string, SemanticObject>>,
  resources: ProjectResources,
  patterns: readonly WordPattern[],
  state: RuntimeState,
  ancestors: readonly string[]=[],
  path=""
): { values: readonly GrammarStructure[]; diagnostics: readonly Diagnostic[]; state?: RuntimeState } {
  if(ancestors.includes(value.id)||ancestors.length>=32)return {values:[],diagnostics:[err("RECURSIVE_WORD_EXPANSION",`Recursive or overly deep semantic expansion at ${value.id}.`,value.id)]};
  const lineage=[...ancestors,value.id];
  const candidates=patterns.filter(p=>matches(p,value,objects)).sort((a,b)=>score(b)-score(a)||(b.priority??0)-(a.priority??0)||a.id.localeCompare(b.id));
  if(!candidates.length){
    // Plain nominal referents do not need a separate authoring rule: their
    // citation form is still project lexicon data. Nontrivial nested objects
    // must match a rule, or their semantic structure would be silently lost.
    if((["Entity","Unknown","Reference"] as string[]).includes(value.type)&&Object.values(value.roles).every(ids=>ids.length===0)){
      const lexeme=value.conceptId?findLexemeByConcept(resources,value.conceptId):undefined;
      if(!lexeme)return {values:[],diagnostics:[err("MISSING_LEXEME",`No lexeme realizes semantic referent ${value.id}.`,value.id)]};
      return {values:[{id:`word:${path}${value.id}:leaf:000`,kind:"MorphCandidate",children:[],features:value.features,data:{patternId:"lexical-leaf",segments:[{kind:"Root",lexemeId:lexeme.id,formKey:"citation",sourceId:value.id}]}}],diagnostics:[]};
    }
    return {values:[],diagnostics:[err("UNSUPPORTED_SEMANTIC_PATTERN",`No authored word pattern realizes ${value.conceptId??value.type}.`,value.id)]};
  }
  const chosen=candidates[0]!;
  if(candidates[1]&&score(candidates[1])===score(chosen)&&(candidates[1].priority??0)===(chosen.priority??0))return {
    values:[],diagnostics:[err("AMBIGUOUS_WORD_PATTERN",`Patterns ${chosen.id} and ${candidates[1].id} are equally applicable.`,value.id)]
  };
  const values:GrammarStructure[]=[];
  let workingState=state;
  const fragments=(parts:readonly WordFragment[]):{segments:LexicalSegment[];diagnostics:Diagnostic[]}=>{
    const segments:LexicalSegment[]=[];
    for(const frag of parts){
      if(frag.kind==="Zero"){
        segments.push({kind:"Zero",featureId:frag.featureId,joinBefore:frag.joinBefore});
        continue;
      }
      const referent=frag.root?value:frag.role?objects[value.roles[frag.role]?.[0]??""]:undefined;
      if(frag.role&&((value.roles[frag.role]?.length??0)!==1||
         (referent&&Object.values(referent.roles).some(targets=>targets.length>0)))){
        return {segments:[],diagnostics:[err("UNEXPANDED_SEMANTIC_ROLE",`Pattern ${chosen.id} must explicitly expand role ${frag.role} instead of discarding its semantic structure.`,value.id)]};
      }
      const conceptId=frag.conceptId??referent?.conceptId;
      if(!conceptId)return {segments:[],diagnostics:[err("MISSING_SEMANTIC_ROLE",`Pattern ${chosen.id} references an absent role/concept.`,value.id)]};
      const lexeme=findLexemeByConcept(resources,conceptId,frag.lexicalClass);
      if(!lexeme)return {segments:[],diagnostics:[err("MISSING_LEXEME",`Pattern ${chosen.id} cannot find lexeme for ${conceptId}.`,value.id)]};
      segments.push({lexemeId:lexeme.id,formKey:frag.formKey??"citation",kind:frag.kind??"Root",joinBefore:frag.joinBefore,sourceId:referent?.id??value.id});
    }
    return {segments,diagnostics:[]};
  };
  const addWord=(parts:readonly WordFragment[],index:number):readonly Diagnostic[]=>{
    const built=fragments(parts);
    if(built.diagnostics.length)return built.diagnostics;
    values.push({id:`word:${path}${value.id}:${chosen.id}:${String(index).padStart(3,"0")}:${values.length}`,kind:"MorphCandidate",children:[],features:value.features,data:{segments:built.segments,patternId:chosen.id}});
    return [];
  };
  for(let index=0;index<chosen.words.length;index++){
    const piece=chosen.words[index]!;
    if(!isExpansion(piece)){
      const d=addWord(piece,index);if(d.length)return {values:[],diagnostics:d};
      continue;
    }
    const targets=value.roles[piece.expandRole]??[];
    if(piece.minItems!==undefined&&targets.length<piece.minItems)return {values:[],diagnostics:[err("SEMANTIC_ROLE_CARDINALITY",`Pattern ${chosen.id} requires at least ${piece.minItems} members of role ${piece.expandRole}.`,value.id)]};
    if(targets.length===0)return {values:[],diagnostics:[err("MISSING_SEMANTIC_ROLE",`Pattern ${chosen.id} requires ${piece.expandRole}.`,value.id)]};
    for(let targetIndex=0;targetIndex<targets.length;targetIndex++){
      if(targetIndex&&piece.separatorWords){
        for(const word of piece.separatorWords){const d=addWord(word,index);if(d.length)return {values:[],diagnostics:d};}
      }
      const target=objects[targets[targetIndex]!]!;
      if(!target)return {values:[],diagnostics:[err("MISSING_SEMANTIC_ROLE",`Pattern ${chosen.id} references missing ${targets[targetIndex]}.`,value.id)]};
      // A type-invalid child is a type error even if its features also fail.
      // Resolve this before feature matching so authoring diagnostics identify
      // the structural mistake instead of a secondary missing mood marker.
      if(piece.acceptedTypes && !piece.acceptedTypes.includes(target.type)) {
        return {values:[],diagnostics:[err("REQUIREMENT_TYPE_MISMATCH",`Pattern ${chosen.id} requires ${piece.expandRole} to be ${piece.acceptedTypes.join(" or ")}, received ${target.type}.`,target.id)]};
      }
      if(piece.requiredFeatures && !Object.entries(piece.requiredFeatures).every(([name,expected])=>Object.is(target.features.values[name],expected))) {
        return {values:[],diagnostics:[err("REQUIREMENT_FEATURE_MISMATCH",`Pattern ${chosen.id} requires ${piece.expandRole} to have semantic features ${JSON.stringify(piece.requiredFeatures)}.`,target.id)]};
      }
      const callId=`${path}${value.id}:${index}:${targetIndex}`;
      let scopeId:string|undefined;
      let requirementId:string|undefined;
      if(piece.scopeType){
        scopeId=`scope:word:${callId}`;
        requirementId=`requirement:word:${callId}`;
        workingState=openScope(workingState,{id:scopeId,type:piece.scopeType});
        workingState=openRequirement(workingState,{id:requirementId,creatorId:value.id,acceptedTypes:piece.acceptedTypes??[
          "Entity","Group","Event","State","Property","Relation","Quantity","Proposition","Unknown","Reference","Modality","SemanticList"
        ]});
      }
      const nested=realize(target,objects,resources,patterns,workingState,lineage,`${callId}/`);
      if(nested.diagnostics.length)return {values:[],diagnostics:nested.diagnostics};
      if(!nested.values.length)return {values:[],diagnostics:[err("EMPTY_SEMANTIC_EXPANSION",`Pattern ${chosen.id} produced no words for ${target.id}.`,value.id)]};
      workingState=nested.state??workingState;
      if(scopeId&&requirementId){
        const resolved=resolveRequirement(workingState,requirementId,target);
        if(resolved.diagnostics.length)return {values:[],diagnostics:resolved.diagnostics};
        workingState=closeScope(resolved.state,scopeId);
      }
      const prefixed=[...nested.values];
      if(targetIndex>0&&piece.prefix){
        const p=fragments(piece.prefix);
        if(p.diagnostics.length)return {values:[],diagnostics:p.diagnostics};
        const first=nested.values[0]!;
        const children=first.data?.segments as readonly LexicalSegment[]|undefined;
        if(!children?.length)return {values:[],diagnostics:[err("INVALID_LEXICAL_SEGMENTS",`Pattern ${chosen.id} cannot conjoin a prefix to an empty nested word.`,value.id)]};
        const [head,...tail]=children;
        prefixed[0]={...first,data:{...first.data,segments:[...p.segments,{...head,joinBefore:piece.prefixBoundary??head.joinBefore},...tail]}};
      }
      values.push(...prefixed);
      if(piece.suffix){
        const d=fragments(piece.suffix);
        if(d.diagnostics.length)return {values:[],diagnostics:d.diagnostics};
        const last=values.at(-1)!;
        values[values.length-1]={...last,data:{...last.data,segments:[...(last.data?.segments as readonly LexicalSegment[]),...d.segments]}};
      }
      if(values.length>4096)return {values:[],diagnostics:[err("MAX_WORD_EXPANSION",`Pattern ${chosen.id} generated too many words.`,value.id)]};
    }
  }
  return {values,diagnostics:[],state:workingState};
}

export function registerWordRealizationPrimitives(registry:NodeRegistry):void {
  registry.register({
    typeId:"grammar.realize-words",
    inputs:[{id:"value",direction:"input",acceptedTypes:["Entity","Group","Event","State","Property","Relation","Quantity","Proposition","Unknown","Reference","Modality","SemanticList"],cardinality:"ONE",required:true}],
    outputs:[{id:"value",direction:"output",acceptedTypes:["MorphCandidate"],cardinality:"MANY",required:false}],
    evaluate:(context,inputs,params)=>{
      if(!Array.isArray(params.patterns)||!params.patterns.every(validPattern))return {outputs:{value:[]},diagnostics:[err("INVALID_WORD_PATTERNS","Expected valid authored word patterns.")]};
      const resources=context.resources as ProjectResources|undefined;
      if(!resources)return {outputs:{value:[]},diagnostics:[err("MISSING_PROJECT_RESOURCES","Word realization requires project lexicon resources.")]};
      const value=inputs.value[0] as SemanticObject;
      const result=realize(value,context.state.semanticGraph.objects,resources,params.patterns,context.state);
      return {outputs:{value:result.values as readonly CompilerValue[]},diagnostics:result.diagnostics,state:result.state};
    }
  });
  registry.register({
    typeId:"morph.lexical",
    inputs:[{id:"value",direction:"input",acceptedTypes:["MorphCandidate"],cardinality:"ONE",required:true}],
    outputs:[{id:"value",direction:"output",acceptedTypes:["MorphSequence"],cardinality:"ONE",required:true}],
    evaluate:(context,inputs)=>{
      const candidate=inputs.value[0] as GrammarStructure;
      const raw=candidate.data?.segments;
      if(!Array.isArray(raw)||!raw.every(x=>rec(x)&&typeof x.kind==="string"))return {outputs:{value:[]},diagnostics:[err("INVALID_LEXICAL_SEGMENTS",`Candidate ${candidate.id} has no valid lexical fragments.`,candidate.id)]};
      const resources=context.resources as ProjectResources|undefined;
      if(!resources)return {outputs:{value:[]},diagnostics:[err("MISSING_PROJECT_RESOURCES","Lexical morphology requires project lexicon resources.")]};
      const morphs:import("../../core-types/src/index.js").Morph[]=[];
      for(let i=0;i<raw.length;i++){
        const segment=raw[i] as LexicalSegment;
        if(segment.kind==="Zero"){
          morphs.push({id:`zero:${candidate.id}:${i}`,kind:"Zero",featureId:segment.featureId??"zero",features:candidate.features,sourceObjectId:segment.sourceId});
          continue;
        }
        const lexeme=resources.lexemes[segment.lexemeId??""];
        const form=lexeme?.forms[segment.formKey??"citation"];
        if(form===undefined)return {outputs:{value:[]},diagnostics:[err("MISSING_LEXEME_FORM",`Lexeme ${segment.lexemeId??"?"} has no form ${segment.formKey??"citation"}.`,candidate.id)]};
        const shared={id:`morph:${candidate.id}:${i}`,form,features:candidate.features,boundaryBefore:segment.joinBefore,sourceObjectId:segment.sourceId};
        morphs.push(segment.kind==="Prefix"||segment.kind==="Suffix"?{...shared,kind:"Affix",position:segment.kind}:{...shared,kind:"Root"});
      }
      return {outputs:{value:[{id:`mseq:${candidate.id}`,morphs}]},diagnostics:[]};
    }
  });
}
