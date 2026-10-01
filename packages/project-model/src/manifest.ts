import type { CompilerStage, StableId } from "../../core-types/src/index.js";
import type { DecodeResult } from "./model.js";

export const CURRENT_PROJECT_SCHEMA_VERSION = 2 as const;

export interface LanguagePackMetadata {
  readonly tag: string;
  readonly display_name: string;
  readonly autonym: string;
  readonly direction: "ltr" | "rtl";
  readonly capabilities: readonly ("generate" | "analyze")[];
}

export interface ProjectDependency { readonly id: string; readonly version?: string; }
export interface ProjectManifestV1 {
  readonly schema_version: 1;
  readonly id: StableId;
  readonly name: string;
  readonly version: string;
  readonly default_language: string;
  readonly graphs: Readonly<Partial<Record<CompilerStage, readonly string[]>>>;
  readonly lexicons: readonly string[];
  readonly features: readonly string[];
  readonly concepts: readonly string[];
  readonly tables: readonly string[];
  readonly node_groups: readonly string[];
  readonly tests: readonly string[];
  readonly settings: string;
  readonly layouts: readonly string[];
  readonly dependencies: readonly ProjectDependency[];
}
export interface ProjectManifestV2 extends Omit<ProjectManifestV1, "schema_version"> {
  readonly schema_version: 2;
  readonly language?: LanguagePackMetadata;
}
export type ProjectManifest = ProjectManifestV1 | ProjectManifestV2;

const stages = new Set<CompilerStage>(["Meaning","Grammar","Morphology","Phonology","Surface","Utility","OrthographyAnalysis","MorphologyAnalysis","GrammarAnalysis","MeaningAnalysis"]);
function rec(v:unknown):v is Record<string,unknown>{ return !!v && typeof v==="object" && !Array.isArray(v); }
function str(v:unknown):v is string { return typeof v==="string"; }
function strs(v:unknown):v is string[] { return Array.isArray(v)&&v.every(str); }
function invalid(message:string):DecodeResult<ProjectManifest>{ return {diagnostics:[{severity:"Error",code:"INVALID_PROJECT_MANIFEST",message}]}; }

export function decodeProjectManifest(raw:unknown):DecodeResult<ProjectManifest>{
  if(!rec(raw) || (raw.schema_version!==1 && raw.schema_version!==2)) return invalid("Project manifest must use schema_version 1 or 2.");
  for(const key of ["id","name","version","default_language","settings"] as const) if(!str(raw[key])) return invalid(`Project manifest field ${key} must be a string.`);
  for(const key of ["lexicons","features","concepts","tables","node_groups","tests","layouts"] as const) if(!strs(raw[key])) return invalid(`Project manifest field ${key} must be a string array.`);
  if(!rec(raw.graphs)) return invalid("Project manifest graphs must be an object.");
  const graphs:Partial<Record<CompilerStage,readonly string[]>>={};
  for(const [stage,paths] of Object.entries(raw.graphs)){ if(!stages.has(stage as CompilerStage)||!strs(paths)) return invalid(`Invalid graph stage ${stage}.`); graphs[stage as CompilerStage]=paths; }
  if(!Array.isArray(raw.dependencies)||!raw.dependencies.every(d=>rec(d)&&str(d.id)&&(d.version===undefined||str(d.version)))) return invalid("Project manifest dependencies are invalid.");
  if(raw.schema_version===2 && raw.language!==undefined){
    const language=raw.language;
    if(!rec(language)||!str(language.tag)||!str(language.display_name)||!str(language.autonym)||!(["ltr","rtl"].includes(String(language.direction)))||
      !Array.isArray(language.capabilities)||!language.capabilities.every((cap:unknown)=>cap==="generate"||cap==="analyze")||new Set(language.capabilities).size!==language.capabilities.length)
      return invalid("Language metadata must declare valid tag, names, direction and distinct capabilities.");
  }
  return {value:{
    schema_version:raw.schema_version as 1|2,
    id:raw.id as string,
    name:raw.name as string,
    version:raw.version as string,
    default_language:raw.default_language as string,
    graphs,
    lexicons:raw.lexicons as string[],
    features:raw.features as string[],
    concepts:raw.concepts as string[],
    tables:raw.tables as string[],
    node_groups:raw.node_groups as string[],
    tests:raw.tests as string[],
    settings:raw.settings as string,
    layouts:raw.layouts as string[],
    dependencies:raw.dependencies as unknown as readonly ProjectDependency[],
    ...(raw.schema_version===2 && raw.language!==undefined?{language:raw.language as unknown as LanguagePackMetadata}:{})
  } as ProjectManifest,diagnostics:[]};
}
