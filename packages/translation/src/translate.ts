import {analyzeSurface,compileMeaningGraph,type AnalyzeOptions,type AnalyzerProject,type CompileOptions,type CompilerProject} from "../../compiler/src/index.js";
import type {Diagnostic,SemanticGraph,StableId} from "../../core-types/src/index.js";
import type {LoadedVertaxProject} from "../../project-model/src/model.js";
import {validateSharedSemantics} from "../../project-model/src/language-pack.js";
import type {NodeRegistry} from "../../runtime/src/index.js";

export interface TranslationCandidate {readonly id:StableId;readonly meaning:SemanticGraph;readonly targetSurface?:string;readonly diagnostics:readonly Diagnostic[];}
export interface TranslationResult {readonly success:boolean;readonly needsSelection:boolean;readonly candidates:readonly TranslationCandidate[];readonly selectedCandidateId?:StableId;readonly surface?:string;readonly diagnostics:readonly Diagnostic[];}
export interface TranslateSurfaceArgs {
  readonly sourceProject:AnalyzerProject;
  readonly sourceRegistry:NodeRegistry;
  readonly targetProject:CompilerProject;
  readonly targetRegistry:NodeRegistry;
  readonly sourceLoaded:LoadedVertaxProject;
  readonly targetLoaded:LoadedVertaxProject;
  readonly text:string;
  readonly candidateId?:StableId;
  readonly options:AnalyzeOptions&CompileOptions;
}
const error=(code:string,message:string):Diagnostic=>({severity:"Error",code,message});
export function translateSurface(args:TranslateSurfaceArgs):TranslationResult {
  const empty=(diagnostics:readonly Diagnostic[],candidates:readonly TranslationCandidate[]=[]):TranslationResult=>({success:false,needsSelection:false,candidates,diagnostics});
  const compatibility=validateSharedSemantics(args.sourceLoaded.concepts,args.targetLoaded.concepts);
  if(compatibility.length)return empty(compatibility);
  const analyzed=analyzeSurface(args.sourceProject,args.sourceRegistry,args.text,args.options);
  const candidates:TranslationCandidate[]=analyzed.candidates.map(c=>({id:c.id,meaning:c.meaning,diagnostics:[]}));
  if(!analyzed.success || candidates.length===0)return empty(analyzed.diagnostics.length?analyzed.diagnostics:[error("NO_ANALYSIS_CANDIDATES","No semantic hypothesis was found.")],candidates);
  let candidate=candidates[0]!;
  if(args.candidateId){const selected=candidates.find(c=>c.id===args.candidateId);if(!selected)return empty([error("UNKNOWN_ANALYSIS_CANDIDATE",`Candidate ${args.candidateId} was not returned by source analysis.`)],candidates);candidate=selected;}
  else if(candidates.length>1)return {success:false,needsSelection:true,candidates,diagnostics:[{severity:"Warning",code:"AMBIGUOUS_ANALYSIS",message:`${candidates.length} semantic interpretations require explicit selection.`}]};
  for(const object of Object.values(candidate.meaning.objects)){
    const id=object.conceptId;
    if(id?.startsWith("sem:")&&!args.targetLoaded.concepts[id])return empty([error("UNSUPPORTED_TARGET_CONCEPT",`Target pack cannot realize shared concept ${id}.`)],candidates);
  }
  const generated=compileMeaningGraph(args.targetProject,args.targetRegistry,candidate.meaning,args.options);
  if(!generated.success||generated.surface===undefined)return empty(generated.diagnostics,candidates);
  return {success:true,needsSelection:false,selectedCandidateId:candidate.id,surface:generated.surface,candidates:candidates.map(c=>c.id===candidate.id?{...c,targetSurface:generated.surface,diagnostics:generated.diagnostics}:c),diagnostics:[...analyzed.diagnostics,...generated.diagnostics]};
}
