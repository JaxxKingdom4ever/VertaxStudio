import {analyzeSurface,compileMeaningGraph,type AnalyzeOptions} from '../../compiler/src/index.js';
import {validateSemanticGraph,type SemanticGraph} from '../../core-types/src/index.js';
import type {LoadedVertaxProject} from '../../project-model/src/model.js';
import {toAnalyzerProject,toCompilerProject} from '../../project-model/src/compiler-adapter.js';
import type {NodeRegistry} from '../../runtime/src/index.js';

export interface PersistedTestFailure {readonly id:string;readonly message:string;}
export interface PersistedTestReport {readonly total:number;readonly passed:number;readonly failures:readonly PersistedTestFailure[];}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Runs authored project cases through the same public analyzer/generator as the CLI. */
export function runPersistedPackTests(project:LoadedVertaxProject, registry:NodeRegistry, options:AnalyzeOptions):PersistedTestReport {
 const failures:PersistedTestFailure[]=[];
 const tests=Object.values(project.tests).sort((a,b)=>a.id.localeCompare(b.id));
 const analyzer=toAnalyzerProject(project).project,generator=toCompilerProject(project).project;
 for(const test of tests){
  try{
   if(test.input_stage==='Meaning'){
    if(test.expected_stage!=='Surface'||!record(test.input)||!record(test.input.objects)||!Array.isArray(test.input.roots)||!record(test.expected_output))throw Error('Invalid persisted Meaning→Surface test.');
    if(!generator)throw Error('Target project cannot generate.');
    const graph=test.input as unknown as SemanticGraph;
    const structural=validateSemanticGraph(graph);
    if(structural.length)throw Error(`Invalid input MeaningGraph: ${structural.map(d=>d.code).join(',')}`);
    const expected=test.expected_output;
    const result=compileMeaningGraph(generator,registry,graph,options);
    if(typeof expected.surface!=='string')throw Error('Meaning→Surface test must declare expected_output.surface.');
    if(!result.success||result.surface!==expected.surface)throw Error(`Expected ${JSON.stringify(expected.surface)}, got ${JSON.stringify(result.surface)}; diagnostics: ${result.diagnostics.map(d=>d.code).join(',')}`);
    continue;
   }
   if(test.input_stage!=='OrthographyAnalysis'||!analyzer)throw Error('Only supported reverse-analysis tests can execute with this pack.');
   if(!record(test.input)||typeof test.input.text!=='string'||!record(test.expected_output))throw Error('Invalid analysis test input/expectation.');
   const expected=test.expected_output;
   const result=analyzeSurface(analyzer,registry,test.input.text,options);
   if(typeof expected.success==='boolean'&&result.success!==expected.success)throw Error(`Expected success ${expected.success}, got ${result.success}: ${result.diagnostics.map(d=>d.code).join(',')}`);
   if(typeof expected.candidateCount==='number'&&result.candidates.length!==expected.candidateCount)throw Error(`Expected ${expected.candidateCount} meaning candidates, got ${result.candidates.length}.`);
   // Test all ambiguity alternatives independently of the hash-derived candidate
   // ordering. A path is a sequence of semantic roles starting at the root;
   // null explicitly asserts that a role is absent in that interpretation.
   if(expected.candidateRoleConceptPaths!==undefined){
    if(!Array.isArray(expected.candidateRoleConceptPaths)||!expected.candidateRoleConceptPaths.every(record))
      throw Error('candidateRoleConceptPaths must be an array of role-path maps.');
    const descriptors=expected.candidateRoleConceptPaths as Record<string,unknown>[];
    if(descriptors.length!==result.candidates.length)throw Error(`Expected ${descriptors.length} candidate role maps, got ${result.candidates.length} candidates.`);
    const matches=(index:number,description:Record<string,unknown>):boolean=>{
     const meaning=result.candidates[index]!.meaning;
     return Object.entries(description).every(([path,concept])=>{
      if(concept!==null&&typeof concept!=='string')return false;
      let id:string|undefined=meaning.roots[0];
      const steps=path.split('.');
      for(let n=0;n<steps.length;n++){
       const role=steps[n]!;
       if(!role||/^\d+$/.test(role))return false;
       let index=0;
       if(/^\d+$/.test(steps[n+1]??'')){index=Number(steps[++n]);}
       id=id?meaning.objects[id]?.roles[role]?.[index]:undefined;
      }
      const actual=id?meaning.objects[id]?.conceptId:undefined;
      return concept===null?actual===undefined:actual===concept;
     });
    };
    const assign=(position:number,used:Set<number>):boolean=>{
     if(position===descriptors.length)return true;
     for(let i=0;i<result.candidates.length;i++)if(!used.has(i)&&matches(i,descriptors[position]!)){
      used.add(i);if(assign(position+1,used))return true;used.delete(i);
     }
     return false;
    };
    if(!assign(0,new Set()))throw Error('Candidate semantic role paths do not match the expected interpretation set.');
   }
   if(typeof expected.rootConcept==='string'&&result.candidates[0]?.meaning.objects[result.candidates[0]?.meaning.roots[0]??'']?.conceptId!==expected.rootConcept)throw Error('Root semantic concept mismatch.');
   const graph=result.candidates[0]?.meaning;
   const root=graph?.objects[graph.roots[0]??''];
   if(typeof expected.rootType==='string'&&root?.type!==expected.rootType)throw Error(`rootType expected ${expected.rootType}, got ${root?.type??'none'}.`);
   if(record(expected.rootFeatures))for(const [name,required] of Object.entries(expected.rootFeatures)){
    if(!root||!Object.is(root.features.values[name],required))throw Error(`rootFeatures.${name} expected ${JSON.stringify(required)}, got ${JSON.stringify(root?.features.values[name])}.`);
   }
   for(const [key,field] of [['roleConcepts','conceptId'],['roleTypes','type']] as const){
    if(!record(expected[key]))continue;
    for(const [name,required] of Object.entries(expected[key])){
     const referentId=root?.roles[name]?.[0];
     const actual=referentId?graph?.objects[referentId]?.[field]:undefined;
     if(!Object.is(actual,required))throw Error(`${key}.${name} expected ${JSON.stringify(required)}, got ${JSON.stringify(actual)}.`);
    }
   }
   if(typeof expected.surface==='string'){
    if(!generator)throw Error('A target-generation project is required for surface assertions.');
    if(result.candidates.length!==1)throw Error('A surface assertion needs exactly one unambiguous source meaning.');
    const generated=compileMeaningGraph(generator,registry,result.candidates[0]!.meaning,options);
    if(!generated.success||generated.surface!==expected.surface)throw Error(`Expected surface ${JSON.stringify(expected.surface)}, got ${JSON.stringify(generated.surface)}, diagnostics: ${generated.diagnostics.map(d=>d.code).join(',')}`);
   }
  }catch(e){failures.push({id:test.id,message:e instanceof Error?e.message:String(e)})}
 }
 return {total:tests.length,passed:tests.length-failures.length,failures};
}
