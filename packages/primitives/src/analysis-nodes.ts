import type {
  AnalyzedToken, CompilerValue, Diagnostic, LexicalOption, MorphAnalysis, OrthographicTokenSequence,
  SemanticGraph, SemanticGraphValue, SemanticObject, SourceText, SyntacticAnalysis
} from "../../core-types/src/index.js";
import type { NodeRegistry, PortDefinition } from "../../runtime/src/index.js";
import type { Lexeme } from "./lexicon.js";
import type { ProjectResources } from "./project-resources.js";
import { findLexemeByConcept } from "./lexicon.js";

const inPort=(type:string):PortDefinition=>({id:"value",direction:"input",acceptedTypes:[type],cardinality:"ONE",required:true});
const outPort=(type:string,required=true):PortDefinition=>({id:"value",direction:"output",acceptedTypes:[type],cardinality:"MANY",required});
const warning=(code:string,message:string):Diagnostic=>({severity:"Warning",code,message});
const failure=(code:string,message:string):Diagnostic=>({severity:"Error",code,message});

/** Language-neutral tokenization: source spans are UTF-16 offsets like JS string slicing. */
export function tokenizeText(value:SourceText):OrthographicTokenSequence {
  const tokens:OrthographicTokenSequence["tokens"][number][]=[];
  const pattern=/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*['’]?|[^\s]/gu;
  for(const match of value.text.matchAll(pattern)){
    const start=match.index;
    tokens.push({id:`${value.id}:token:${tokens.length}`,text:match[0],normalized:match[0].toLowerCase(),start,end:start+match[0].length});
  }
  return {valueType:"OrthographicTokenSequence",id:`${value.id}:orthography`,tokens};
}

export function lexicalizeTokens(sequence:OrthographicTokenSequence, resources:ProjectResources, allowProperNames=false):{value:MorphAnalysis;diagnostics:readonly Diagnostic[]} {
  const entries=Object.values(resources.lexemes).sort((a,b)=>a.id.localeCompare(b.id));
  const diagnostics:Diagnostic[]=[];
  const tokens:AnalyzedToken[]=sequence.tokens.map(token=>{
    const options:LexicalOption[]=[];
    for(const lexeme of entries){
      for(const [formKey,form] of Object.entries(lexeme.forms)){
        if(form.toLowerCase()===token.normalized)options.push({lexemeId:lexeme.id,conceptId:lexeme.conceptId,lexicalClass:lexeme.lexicalClass,formKey});
      }
    }
    // Proper names are tagged, never silently treated as an unrelated lexeme.
    if(!options.length&&allowProperNames&&/^\p{Lu}[\p{L}-]+$/u.test(token.text))options.push({lexemeId:`named:${token.id}`,conceptId:"sem:entity.named",lexicalClass:"ProperNoun",formKey:"citation"});
    if(!options.length&&/[\p{L}\p{N}]/u.test(token.text))diagnostics.push(warning("UNKNOWN_LEXEME",`No lexeme for source token ${JSON.stringify(token.text)} at ${token.start}.`));
    return {token,options};
  });
  return {value:{valueType:"MorphAnalysis",id:`${sequence.id}:lexical`,tokens,features:{values:{}}},diagnostics};
}

interface SlotPattern {
  readonly text?:string;
  readonly classes?:readonly string[];
  readonly formKeys?:readonly string[];
  readonly conceptIds?:readonly string[];
  readonly lexemeIds?:readonly string[];
}
interface MeaningObjectTemplate {
  readonly id:string;
  readonly type:SemanticObject["type"];
  readonly conceptId?:string;
  readonly slot?:number;
  readonly roles?:Readonly<Record<string,readonly string[]>>;
  readonly features?:Readonly<Record<string,unknown>>;
}
interface MeaningTemplate { readonly root:string; readonly objects:readonly MeaningObjectTemplate[]; }
interface SlotConstraint {readonly leftSlot:number;readonly rightSlot:number;readonly allowedPairs:readonly (readonly [string,string])[];}
interface SyntaxPattern { readonly id:string; readonly slots:readonly SlotPattern[]; readonly slotConstraints?:readonly SlotConstraint[]; readonly meaning:MeaningTemplate; }
function isRecord(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function isPattern(v:unknown):v is SyntaxPattern {
  const validSlot=(x:unknown):x is SlotPattern=>isRecord(x)&&
    (x.text===undefined||typeof x.text==="string")&&
    ["classes","formKeys","conceptIds","lexemeIds"].every(field=>
      x[field]===undefined||Array.isArray(x[field])&&(x[field] as unknown[]).every(item=>typeof item==="string"));
  if(!isRecord(v)||typeof v.id!=="string"||!Array.isArray(v.slots)||!v.slots.every(validSlot)||
    !isRecord(v.meaning)||typeof v.meaning.root!=="string"||!Array.isArray(v.meaning.objects))return false;
  return v.slotConstraints===undefined||Array.isArray(v.slotConstraints)&&v.slotConstraints.every(rule=>
    isRecord(rule)&&Number.isInteger(rule.leftSlot)&&Number.isInteger(rule.rightSlot)&&
    (rule.leftSlot as number)>=0&&(rule.rightSlot as number)>=0&&
    (rule.leftSlot as number)<(v.slots as unknown[]).length&&(rule.rightSlot as number)<(v.slots as unknown[]).length&&
    Array.isArray(rule.allowedPairs)&&rule.allowedPairs.every(pair=>
      Array.isArray(pair)&&pair.length===2&&pair.every(x=>typeof x==="string")));
}
/** Do not pick the first form: a written word may have multiple senses and inflections. */
function matchingSlotOptions(slot:SlotPattern,analyzed:AnalyzedToken):readonly LexicalOption[] {
  if(slot.text!==undefined&&slot.text.toLowerCase()!==analyzed.token.normalized)return [];
  const requiresLex=!!(slot.classes?.length||slot.formKeys?.length||slot.conceptIds?.length||slot.lexemeIds?.length);
  if(!requiresLex)return [{lexemeId:"surface:literal",conceptId:"sem:literal",lexicalClass:"Literal",formKey:"citation"}];
  const unique=new Map<string,LexicalOption>();
  for(const option of analyzed.options){
    if((slot.classes?.length&&!slot.classes.includes(option.lexicalClass))||
       (slot.formKeys?.length&&!slot.formKeys.includes(option.formKey))||
       (slot.conceptIds?.length&&!slot.conceptIds.includes(option.conceptId))||
       (slot.lexemeIds?.length&&!slot.lexemeIds.includes(option.lexemeId)))continue;
    const key=JSON.stringify([option.lexemeId,option.conceptId,option.lexicalClass,option.formKey]);
    unique.set(key,option);
  }
  return [...unique].sort(([a],[b])=>a.localeCompare(b)).map(([,option])=>option);
}
interface SyntaxMatches {readonly values:readonly SyntacticAnalysis[];readonly exceeded:boolean;}
/** Constraint-aware backtracking; deterministic and bounded for adversarial homographs. */
function matchSyntaxPatternsBounded(value:MorphAnalysis,patterns:readonly SyntaxPattern[],maxHypotheses:number):SyntaxMatches {
  const results:SyntacticAnalysis[]=[];
  for(const pattern of patterns){
    if(pattern.slots.length!==value.tokens.length)continue;
    const available=pattern.slots.map((slot,i)=>matchingSlotOptions(slot,value.tokens[i]!));
    if(available.some(options=>options.length===0))continue;
    const chosen:LexicalOption[]=[];
    const visit=(index:number):boolean=>{
      if(index===available.length){
        if(results.length>=maxHypotheses)return false;
        const captures=Object.fromEntries(chosen.map((option,i)=>[String(i),{...option,token:value.tokens[i]!.token}]));
        results.push({valueType:"SyntacticAnalysis",id:`${value.id}:syntax:${pattern.id}:reading:${results.length}`,rootId:pattern.meaning.root,
          nodes:{[pattern.meaning.root]:{template:pattern.meaning,captures,patternId:pattern.id}}});
        return true;
      }
      for(const option of available[index]!){
        chosen.push(option);
        const allowed=(pattern.slotConstraints??[]).every(constraint=>{
          if(constraint.leftSlot>=chosen.length||constraint.rightSlot>=chosen.length)return true;
          return constraint.allowedPairs.some(([left,right])=>left===chosen[constraint.leftSlot]?.formKey&&right===chosen[constraint.rightSlot]?.formKey);
        });
        if(allowed&&!visit(index+1))return false;
        chosen.pop();
      }
      return true;
    };
    if(!visit(0))return {values:[],exceeded:true};
  }
  return {values:results,exceeded:false};
}
/** Every valid lexical reading survives until meaning analysis can distinguish it. */
export function matchSyntaxPatterns(value:MorphAnalysis,patterns:readonly SyntaxPattern[]):readonly SyntacticAnalysis[] {
  return matchSyntaxPatternsBounded(value,patterns,Number.POSITIVE_INFINITY).values;
}

export function makeMeaning(value:SyntacticAnalysis, formFeatureMap:Readonly<Record<string,Readonly<Record<string,Readonly<Record<string,unknown>>>>>>={}):{value?:SemanticGraphValue;diagnostics:readonly Diagnostic[]} {
  const entry=value.nodes[value.rootId];
  if(!entry||!isRecord(entry.template)||!Array.isArray(entry.template.objects)||!isRecord(entry.captures))return {diagnostics:[failure("INVALID_SYNTAX_TEMPLATE","Syntactic hypothesis has no usable semantic template.")]};
  const t=entry.template as unknown as MeaningTemplate;
  const captures=entry.captures as Record<string,{conceptId?:string;lexicalClass?:string;formKey?:string;token?:{id:string;text:string;start:number;end:number}}>;
  const objects:Record<string,SemanticObject>={};
  for(const obj of t.objects){
    const cap=obj.slot===undefined?undefined:captures[String(obj.slot)];
    const conceptId=obj.conceptId??cap?.conceptId;
    if(!conceptId)return {diagnostics:[failure("MISSING_SEMANTIC_CONCEPT",`Object ${obj.id} requires a concept or captured lexeme.`)]};
    const mapped=cap?.lexicalClass&&cap?.formKey?formFeatureMap[cap.lexicalClass]?.[cap.formKey]??{}:{};
    objects[obj.id]={id:obj.id,type:obj.type,conceptId,roles:obj.roles??{},features:{values:{...obj.features,...mapped}},provenance:cap?.token?[{kind:"Explicit",sourceId:cap.token.id,note:cap.token.text}]:[]};
  }
  const graph:SemanticGraph={objects,roots:[t.root]};
  const provenanceBySource=new Map<string,NonNullable<SemanticObject['provenance']>[number]>();
  for(const object of Object.values(objects))for(const ref of object.provenance??[]){
    const key=`${ref.kind}:${ref.sourceId}:${ref.note??''}`;
    if(!provenanceBySource.has(key))provenanceBySource.set(key,ref);
  }
  const provenance=[...provenanceBySource.values()].sort((a,b)=>{
    const position=(ref:typeof a)=>Number(/:token:(\d+)$/.exec(ref.sourceId??'')?.[1]??Number.MAX_SAFE_INTEGER);
    return position(a)-position(b)||(a.sourceId??'').localeCompare(b.sourceId??'');
  });
  return {value:{valueType:"SemanticGraphValue",id:`${value.id}:meaning`,graph,provenance},diagnostics:[]};
}

interface GenerationPart {
  readonly literal?:string;
  readonly root?:boolean;
  readonly role?:string;
  readonly embeddedRole?:string;
  readonly embeddedPath?:readonly {readonly role:string;readonly index?:number}[];
  readonly lowercaseInitial?:boolean;
  readonly dropFinalPunctuation?:boolean;
  /** Resolve a nested referent through project-authored semantic roles. */
  readonly path?:readonly {readonly role:string;readonly index?:number}[];
  readonly formKey?:string;
  readonly lexicalClass?:string;
  readonly formKeyFrom?:{readonly role?:string;readonly path?:readonly {readonly role:string;readonly index?:number}[];readonly featureId:string;readonly values:Readonly<Record<string,string>>;readonly default:string};
}
interface GenerationPattern {readonly id:string;readonly conceptId:string;readonly features?:Readonly<Record<string,unknown>>;readonly requiredRoles?:readonly string[];readonly roleConcepts?:Readonly<Record<string,string>>;readonly roleFeatures?:Readonly<Record<string,Readonly<Record<string,unknown>>>>;readonly parts:readonly GenerationPart[];readonly capitalize?:boolean;readonly priority?:number;}
function isRolePath(value:unknown):boolean {
  return Array.isArray(value)&&value.every(step=>isRecord(step)&&typeof step.role==="string"&&
    (step.index===undefined||(typeof step.index==="number"&&Number.isInteger(step.index)&&step.index>=0)));
}
function isGenerationPart(value:unknown):boolean {
  if(!isRecord(value))return false;
  for(const key of ["literal","role","embeddedRole","formKey","lexicalClass"]){
    if(value[key]!==undefined&&typeof value[key]!=="string")return false;
  }
  if(value.path!==undefined&&!isRolePath(value.path))return false;
  if(value.embeddedPath!==undefined&&!isRolePath(value.embeddedPath))return false;
  if(value.formKeyFrom!==undefined){
    const from=value.formKeyFrom;
    if(!isRecord(from)||typeof from.featureId!=="string"||typeof from.default!=="string"||!isRecord(from.values))return false;
    if(from.role!==undefined&&typeof from.role!=="string")return false;
    if(from.path!==undefined&&!isRolePath(from.path))return false;
  }
  return true;
}
function isGenerationPattern(v:unknown):v is GenerationPattern {
  return isRecord(v)&&typeof v.id==="string"&&typeof v.conceptId==="string"&&Array.isArray(v.parts)&&v.parts.every(isGenerationPart);
}
/** A declarative pattern is data in a language pack, never a language-specific code branch. */
export function realizeMeaningTemplate(
  value:SemanticObject,
  graph:SemanticGraph,
  resources:ProjectResources,
  patterns:readonly GenerationPattern[],
  ancestry:readonly string[]=[]
):{value?:{id:string;kind:"MorphCandidate";children:readonly string[];features:{values:Readonly<Record<string,unknown>>};data:{form:string;patternId:string}};diagnostics:readonly Diagnostic[]} {
  if(ancestry.includes(value.id)||ancestry.length>=32)
    return {diagnostics:[failure("RECURSIVE_REALIZATION",`Recursive or excessively deep semantic realization at ${value.id}.`)]};
  const applicable=patterns.filter(p=>
    (p.conceptId==="*"||p.conceptId===value.conceptId)&&
    Object.entries(p.features??{}).every(([key,required])=>Object.is(value.features.values[key],required))&&
    (p.requiredRoles??[]).every(role=>(value.roles[role]?.length??0)>0)&&
    Object.entries(value.roles).every(([role,targets])=>targets.length===0||
      (p.requiredRoles??[]).includes(role)||p.parts.some(part=>part.role===role||part.path?.[0]?.role===role||part.embeddedRole===role||part.embeddedPath?.[0]?.role===role))&&
    Object.entries(p.roleConcepts??{}).every(([role,concept])=>graph.objects[value.roles[role]?.[0]??""]?.conceptId===concept)&&
    Object.entries(p.roleFeatures??{}).every(([role,needed])=>{
      const referent=graph.objects[value.roles[role]?.[0]??""];
      return !!referent&&Object.entries(needed).every(([name,required])=>Object.is(referent.features.values[name],required));
    })
  );
  if(!applicable.length)return {diagnostics:[failure("UNSUPPORTED_SEMANTIC_PATTERN",`No generation pattern for semantic concept ${value.conceptId??"unknown"}.`)]};
  const rank=(p:GenerationPattern)=>Object.keys(p.features??{}).length+Object.keys(p.roleConcepts??{}).length+
    Object.values(p.roleFeatures??{}).reduce((sum,features)=>sum+Object.keys(features).length,0)+(p.conceptId==="*"?0:100);
  const sorted=[...applicable].sort((a,b)=>rank(b)-rank(a)||(b.priority??0)-(a.priority??0)||a.id.localeCompare(b.id));
  const chosen=sorted[0]!;
  if(sorted[1]&&rank(sorted[1])===rank(chosen)&&(sorted[1].priority??0)===(chosen.priority??0))
    return {diagnostics:[failure("AMBIGUOUS_GENERATION_PATTERN",`Patterns ${chosen.id} and ${sorted[1].id} are equally applicable.`)]};
  const segments:string[]=[];
  for(const part of chosen.parts){
    if(part.literal!==undefined){segments.push(part.literal);continue;}
    if(part.embeddedRole!==undefined||part.embeddedPath?.length){
      let nested:SemanticObject|undefined=value;
      for(const step of part.embeddedPath??[{role:part.embeddedRole!,index:0}]){
        const id:string|undefined=nested?.roles[step.role]?.[step.index??0];
        nested=id?graph.objects[id]:undefined;
      }
      if(!nested)return {diagnostics:[failure("MISSING_SEMANTIC_ROLE",`Pattern ${chosen.id} has an unavailable embedded clause path.`)]};
      const generated=realizeMeaningTemplate(nested,graph,resources,patterns,[...ancestry,value.id]);
      if(!generated.value)return generated;
      let clause=generated.value.data.form;
      if(part.dropFinalPunctuation)clause=clause.replace(/[.!?]+$/u,"");
      if(part.lowercaseInitial)clause=clause.charAt(0).toLowerCase()+clause.slice(1);
      segments.push(clause);
      continue;
    }
    let referent:SemanticObject|undefined=part.root?value:part.role?graph.objects[value.roles[part.role]?.[0]??""]:undefined;
    if(part.path){
      referent=value;
      for(const step of part.path){
        const nextId:string|undefined=referent?.roles[step.role]?.[step.index??0];
        referent=nextId?graph.objects[nextId]:undefined;
      }
    }
    if(!referent||!referent.conceptId)return {diagnostics:[failure("MISSING_SEMANTIC_ROLE",`Pattern ${chosen.id} references missing role ${part.role??"root"}.`)]};
    const lexeme=findLexemeByConcept(resources,referent.conceptId,part.lexicalClass);
    if(!lexeme)return {diagnostics:[failure("MISSING_LEXEME",`No lexeme for ${referent.conceptId} in generation pattern ${chosen.id}.`)]};
    let featureSource=part.formKeyFrom?.role?graph.objects[value.roles[part.formKeyFrom.role]?.[0]??""]:undefined;
    if(part.formKeyFrom?.path){
      featureSource=value;
      for(const step of part.formKeyFrom.path){
        const id:string|undefined=featureSource?.roles[step.role]?.[step.index??0];
        featureSource=id?graph.objects[id]:undefined;
      }
    }
    const chosenFormKey=part.formKeyFrom?(part.formKeyFrom.values[String(featureSource?.features.values[part.formKeyFrom.featureId]??"")]??part.formKeyFrom.default):part.formKey??"citation";
    const form=lexeme.forms[chosenFormKey];
    if(form===undefined)return {diagnostics:[failure("MISSING_LEXEME_FORM",`Lexeme ${lexeme.id} lacks form ${chosenFormKey}.`)]};
    segments.push(form);
  }
  let text=segments.join(" ").replaceAll(/\s+([.,!?;:])/g,"$1");
  if(chosen.capitalize)text=text.charAt(0).toUpperCase()+text.slice(1);
  return {value:{id:`generation:${value.id}:${chosen.id}`,kind:"MorphCandidate",children:[],features:value.features,data:{form:text,patternId:chosen.id}},diagnostics:[]};
}

export function registerAnalysisPrimitives(registry:NodeRegistry):void {
  registry.register({typeId:"analysis.realize-template",inputs:[{...inPort("Event"),acceptedTypes:["Event","State","Property","Relation"]}],outputs:[outPort("MorphCandidate",false)],evaluate:(context,inputs,params)=>{
    const resources=context.resources as ProjectResources|undefined;
    if(!resources)return {outputs:{value:[]},diagnostics:[failure("MISSING_ANALYSIS_RESOURCES","Realization needs project lexicon resources.")]};
    if(!Array.isArray(params.patterns)||!params.patterns.every(isGenerationPattern))return {outputs:{value:[]},diagnostics:[failure("INVALID_GENERATION_PATTERNS","patterns must be serializable generation templates.")]};
    const result=realizeMeaningTemplate(inputs.value[0] as SemanticObject,context.state.semanticGraph,resources,params.patterns);
    return {outputs:{value:result.value?[result.value]:[]},diagnostics:result.diagnostics};
  }});
  registry.register({typeId:"analysis.tokenize",inputs:[inPort("SourceText")],outputs:[outPort("OrthographicTokenSequence")],evaluate:(_c,inputs)=>({outputs:{value:[tokenizeText(inputs.value[0] as SourceText)]},diagnostics:[]})});
  registry.register({typeId:"analysis.lexeme-lookup",inputs:[inPort("OrthographicTokenSequence")],outputs:[outPort("MorphAnalysis")],evaluate:(context,inputs,params)=>{
    const resources=context.resources as ProjectResources|undefined;
    if(!resources)return {outputs:{value:[]},diagnostics:[failure("MISSING_ANALYSIS_RESOURCES","Lexical lookup needs project lexicon resources.")]};
    const result=lexicalizeTokens(inputs.value[0] as OrthographicTokenSequence,resources,params.allowProperNames===true);
    return {outputs:{value:[result.value]},diagnostics:result.diagnostics};
  }});
  registry.register({typeId:"analysis.match-pattern",inputs:[inPort("MorphAnalysis")],outputs:[outPort("SyntacticAnalysis",false)],evaluate:(_context,inputs,params)=>{
    if(!Array.isArray(params.patterns)||!params.patterns.every(isPattern))return {outputs:{value:[]},diagnostics:[failure("INVALID_ANALYSIS_PATTERNS","patterns must be an array of serializable syntax templates.")]};
    const max=params.maxHypotheses===undefined?256:params.maxHypotheses;
    if(!Number.isSafeInteger(max)||typeof max!=="number"||max<1)return {outputs:{value:[]},diagnostics:[failure("INVALID_ANALYSIS_LIMIT","maxHypotheses must be a positive integer.")]};
    const matched=matchSyntaxPatternsBounded(inputs.value[0] as MorphAnalysis,params.patterns,max);
    if(matched.exceeded)return {outputs:{value:[]},diagnostics:[failure("MAX_ANALYSIS_HYPOTHESES",`Analysis exceeded ${max} lexical interpretations. Narrow the grammar or increase maxHypotheses.`)]};
    return {outputs:{value:matched.values},diagnostics:[]};
  }});
  registry.register({typeId:"analysis.to-meaning",inputs:[inPort("SyntacticAnalysis")],outputs:[outPort("SemanticGraphValue",false)],evaluate:(_context,inputs,params)=>{
    const mapped=isRecord(params.formFeatureMap)?params.formFeatureMap as Record<string,Record<string,Record<string,unknown>>>:{};
    const result=makeMeaning(inputs.value[0] as SyntacticAnalysis,mapped);
    return {outputs:{value:result.value?[result.value]:[]},diagnostics:result.diagnostics};
  }});
}
