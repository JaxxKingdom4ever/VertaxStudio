import type { AnalyzerProject, CompilerProject, StageProject } from "../../compiler/src/index.js";
import type { CompilerStage, Diagnostic, StableId } from "../../core-types/src/index.js";
import { buildProjectResources } from "./resources.js";
import type { LoadedVertaxProject } from "./model.js";
import { validateProject } from "./validation.js";
export interface CompilerAdapterResult { readonly project?:CompilerProject; readonly diagnostics:readonly Diagnostic[]; }
export interface AnalyzerAdapterResult {readonly project?:AnalyzerProject;readonly diagnostics:readonly Diagnostic[];}
function errors(ds:readonly Diagnostic[]):boolean{return ds.some(x=>x.severity==="Error"||x.severity==="Fatal")}
function buildStage(project:LoadedVertaxProject,stage:CompilerStage):StageProject|undefined{
  const docs=project.stageDocuments.filter(d=>d.stage===stage); if(!docs.length)return undefined;
  const graphs:Record<StableId,import("../../runtime/src/index.js").GraphDefinition>={}; const rules:import("../../runtime/src/index.js").RuleDefinition[]=[];
  for(const doc of docs){graphs[doc.graph.id]=doc.graph;rules.push(...doc.rules)}
  return {stage,graphs,rules};
}
export function toCompilerProject(project:LoadedVertaxProject):CompilerAdapterResult{
  const diagnostics=[...validateProject(project)];
  const resourcesResult=buildProjectResources({concepts:Object.values(project.concepts),features:Object.values(project.features),lexemes:Object.values(project.lexemes),tables:Object.values(project.tables)}); diagnostics.push(...resourcesResult.diagnostics);
  const grammar=buildStage(project,"Grammar"),morphology=buildStage(project,"Morphology"),phonology=buildStage(project,"Phonology"),surface=buildStage(project,"Surface");
  for(const [name,value] of [["Grammar",grammar],["Morphology",morphology],["Surface",surface]] as const)if(!value)diagnostics.push({severity:"Error",code:"MISSING_REQUIRED_STAGE",message:`Project is missing required ${name} stage.`});
  if(errors(diagnostics)||!resourcesResult.resources||!grammar||!morphology||!surface)return {diagnostics};
  return {project:{grammar,morphology,...(phonology?{phonology}:{}),surface,resources:resourcesResult.resources},diagnostics};
}

/** Analyzers are optional: never infer capability from a generation-only project. */
export function toAnalyzerProject(project:LoadedVertaxProject):AnalyzerAdapterResult{
  if(!("language" in project.manifest)||!project.manifest.language?.capabilities.includes("analyze"))return {diagnostics:[{severity:"Error",code:"NO_ANALYZER_CAPABILITY",message:"Project does not declare surface analysis capability."}]};
  const diagnostics=[...validateProject(project)];
  const resourcesResult=buildProjectResources({concepts:Object.values(project.concepts),features:Object.values(project.features),lexemes:Object.values(project.lexemes),tables:Object.values(project.tables)});
  diagnostics.push(...resourcesResult.diagnostics);
  const orthography=buildStage(project,"OrthographyAnalysis"),morphology=buildStage(project,"MorphologyAnalysis"),grammar=buildStage(project,"GrammarAnalysis"),meaning=buildStage(project,"MeaningAnalysis");
  for(const [stage,value] of [["OrthographyAnalysis",orthography],["MorphologyAnalysis",morphology],["GrammarAnalysis",grammar],["MeaningAnalysis",meaning]] as const)if(!value)diagnostics.push({severity:"Error",code:"MISSING_ANALYSIS_STAGE",message:`Pack is missing required ${stage} stage.`});
  if(errors(diagnostics)||!resourcesResult.resources||!orthography||!morphology||!grammar||!meaning)return {diagnostics};
  return {project:{orthography,morphology,grammar,meaning,resources:resourcesResult.resources},diagnostics};
}
