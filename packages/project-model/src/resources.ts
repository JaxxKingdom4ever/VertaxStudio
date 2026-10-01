import type { Diagnostic, FeatureDefinition, StableId } from "../../core-types/src/index.js";
import type { ConceptDefinition, DataTable, Lexeme, ProjectResources, ValencySlot } from "../../primitives/src/index.js";
import type { DecodeResult } from "./model.js";

export interface ResourceDocuments {
  readonly concepts: readonly ConceptDefinition[];
  readonly features: readonly FeatureDefinition[];
  readonly lexemes: readonly Lexeme[];
  readonly tables: readonly DataTable[];
}
export interface BuildResourcesResult { readonly resources?: ProjectResources; readonly diagnostics: readonly Diagnostic[]; }

function rec(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v)}
function str(v:unknown):v is string{return typeof v==="string"}
function bool(v:unknown):v is boolean{return typeof v==="boolean"}
function strArray(v:unknown):v is string[]{return Array.isArray(v)&&v.every(str)}
function error<T>(code:string,message:string):DecodeResult<T>{return {diagnostics:[{severity:"Error",code,message}]}}
function duplicate<T extends {id:string}>(items:readonly T[], code="DUPLICATE_RESOURCE_ID"):Diagnostic[]{const seen=new Set<string>();const ds:Diagnostic[]=[];for(const x of items){if(seen.has(x.id))ds.push({severity:"Error",code,message:`Duplicate resource ID ${x.id}.`,objectId:x.id});seen.add(x.id)}return ds}

export function decodeConcepts(raw:unknown):DecodeResult<readonly ConceptDefinition[]>{
  if(!Array.isArray(raw))return error("INVALID_CONCEPTS","Concepts document must be an array.");
  const out:ConceptDefinition[]=[];
  for(const item of raw){
    if(!rec(item)||!str(item.id)||!str(item.label)||(item.description!==undefined&&!str(item.description))||(item.semanticType!==undefined&&!str(item.semanticType))||!rec(item.metadata))return error("INVALID_CONCEPT","Concept definition is invalid.");
    const concept:ConceptDefinition={id:item.id,label:item.label,metadata:item.metadata};
    if(item.description!==undefined) Object.defineProperty(concept,"description",{value:item.description,enumerable:true});
    if(item.semanticType!==undefined) Object.defineProperty(concept,"semanticType",{value:item.semanticType,enumerable:true});
    out.push(concept);
  }
  const ds=duplicate(out);return ds.length?{diagnostics:ds}:{value:out,diagnostics:[]};
}
export function decodeFeatures(raw:unknown):DecodeResult<readonly FeatureDefinition[]>{
  if(!Array.isArray(raw))return error("INVALID_FEATURES","Features document must be an array.");
  const out:FeatureDefinition[]=[];
  for(const item of raw){
    if(!rec(item)||!str(item.id)||!str(item.label)||!strArray(item.allowedValues)||(item.defaultValue!==undefined&&!str(item.defaultValue))||!strArray(item.allowedOn)||!(["none","copy","scope"] as unknown[]).includes(item.inheritance))return error("INVALID_FEATURE_DEFINITION","Feature definition is invalid.");
    if(item.defaultValue!==undefined&&!item.allowedValues.includes(item.defaultValue as string))return error("INVALID_FEATURE_DEFAULT",`Feature ${item.id} default is outside allowedValues.`);
    const feature:FeatureDefinition={id:item.id,label:item.label,allowedValues:item.allowedValues,allowedOn:item.allowedOn,inheritance:item.inheritance as FeatureDefinition["inheritance"]};
    if(item.defaultValue!==undefined)(feature as {defaultValue:string}).defaultValue=item.defaultValue as string;
    out.push(feature);
  }
  const ds=duplicate(out);return ds.length?{diagnostics:ds}:{value:out,diagnostics:[]};
}
function valency(v:unknown):v is ValencySlot{return rec(v)&&str(v.role)&&strArray(v.acceptedTypes)&&bool(v.required)&&(["ONE","OPTIONAL","MANY"] as unknown[]).includes(v.cardinality)}
export function decodeLexicon(raw:unknown):DecodeResult<readonly Lexeme[]>{
  if(!Array.isArray(raw))return error("INVALID_LEXICON","Lexicon document must be an array.");
  const out:Lexeme[]=[];
  for(const item of raw){
    if(!rec(item)||!str(item.id)||!str(item.conceptId)||!str(item.lexicalClass)||!rec(item.forms)||!Object.values(item.forms).every(str)||!rec(item.features)||!rec(item.features.values)||!Array.isArray(item.valency)||!item.valency.every(valency)||!rec(item.relatedLexemes)||!Object.values(item.relatedLexemes).every(strArray)||!strArray(item.irregularRuleIds)||!rec(item.metadata))return error("INVALID_LEXEME","Lexeme definition is invalid.");
    out.push({id:item.id,conceptId:item.conceptId,lexicalClass:item.lexicalClass,forms:item.forms as Record<string,string>,features:{values:(item.features as Record<string,unknown>).values as Record<string,unknown>},valency:item.valency as unknown as ValencySlot[],relatedLexemes:item.relatedLexemes as Record<string,string[]>,irregularRuleIds:item.irregularRuleIds,metadata:item.metadata});
  }
  const ds=duplicate(out);return ds.length?{diagnostics:ds}:{value:out,diagnostics:[]};
}
export function decodeDataTable(raw:unknown):DecodeResult<DataTable>{
  if(!rec(raw)||!str(raw.id)||!str(raw.label)||!strArray(raw.columns)||!Array.isArray(raw.rows)||!raw.rows.every(rec)||!rec(raw.metadata))return error("INVALID_DATA_TABLE","Data table is invalid.");
  return {value:{id:raw.id,label:raw.label,columns:raw.columns,rows:raw.rows as Record<string,unknown>[],metadata:raw.metadata},diagnostics:[]};
}
export function buildProjectResources(documents:ResourceDocuments):BuildResourcesResult{
  const diagnostics:Diagnostic[]=[];
  diagnostics.push(...duplicate(documents.concepts),...duplicate(documents.features),...duplicate(documents.lexemes),...duplicate(documents.tables));
  const concepts=Object.fromEntries(documents.concepts.map(x=>[x.id,x]));
  const featureDefinitions=Object.fromEntries(documents.features.map(x=>[x.id,x]));
  const lexemes=Object.fromEntries(documents.lexemes.map(x=>[x.id,x]));
  const tables=Object.fromEntries(documents.tables.map(x=>[x.id,x]));
  for(const lex of documents.lexemes){
    if(!concepts[lex.conceptId]) diagnostics.push({severity:"Error",code:"MISSING_CONCEPT_REFERENCE",message:`Lexeme ${lex.id} references missing concept ${lex.conceptId}.`,objectId:lex.id});
    for(const ids of Object.values(lex.relatedLexemes)) for(const id of ids) if(!lexemes[id]) diagnostics.push({severity:"Error",code:"MISSING_LEXEME_REFERENCE",message:`Lexeme ${lex.id} references missing related lexeme ${id}.`,objectId:lex.id});
  }
  if(diagnostics.some(d=>d.severity==="Error"||d.severity==="Fatal")) return {diagnostics};
  const conceptToLexemeIds:Record<StableId,StableId[]>={};
  for(const lex of documents.lexemes)(conceptToLexemeIds[lex.conceptId]??=[]).push(lex.id);
  for(const ids of Object.values(conceptToLexemeIds))ids.sort();
  return {resources:{concepts,featureDefinitions,lexemes,conceptToLexemeIds,tables},diagnostics};
}
