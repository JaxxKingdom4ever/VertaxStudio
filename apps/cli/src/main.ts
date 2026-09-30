declare const process: { argv: string[]; exitCode?: number };
import { analyzeSurface, compileMeaningGraph } from "../../../packages/compiler/src/index.js";
import { loadProject, toAnalyzerProject, toCompilerProject, validateProject, registerPersistedNodeGroups } from "../../../packages/project-model/src/index.js";
import { runPersistedPackTests, translateSurface } from "../../../packages/translation/src/index.js";
import { NodeRegistry } from "../../../packages/runtime/src/index.js";
import { registerCorePrimitives } from "../../../packages/primitives/src/index.js";

function printDiagnostics(ds:readonly {severity:string;code:string;message:string}[]):void{for(const d of ds)console.error(`${d.severity} ${d.code}: ${d.message}`)}
async function main():Promise<void>{
  const command=process.argv[2] ?? "compile";
  if(command==="validate-project"){
    const path=process.argv[3]; if(!path){console.error("Error MISSING_PROJECT_PATH: validate-project requires a path.");process.exitCode=1;return;}
    const loaded=await loadProject(path); if(!loaded.project){printDiagnostics(loaded.diagnostics);process.exitCode=1;return;}
    const diagnostics=[...loaded.diagnostics,...validateProject(loaded.project)];
    if(diagnostics.some(d=>d.severity==="Error"||d.severity==="Fatal")){printDiagnostics(diagnostics);process.exitCode=1;return;}
    console.log(`Valid Vertax project: ${loaded.project.manifest.name} (schema ${loaded.project.manifest.schema_version})`); return;
  }
  if(command==="test-project"){
    const path=process.argv[3];if(!path){console.error('Error MISSING_PROJECT_PATH: test-project requires a path.');process.exitCode=1;return;}
    const result=await loadProject(path);if(!result.project){printDiagnostics(result.diagnostics);process.exitCode=1;return;}
    const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,result.project.nodeGroups);
    const report=runPersistedPackTests(result.project,registry,{mode:'fast',maxStepsPerStage:100});
    for(const failure of report.failures)console.error(`FAIL ${failure.id}: ${failure.message}`);
    console.log(`${report.passed}/${report.total} passed`);
    if(report.failures.length)process.exitCode=1;return;
  }
  if(command==="analyze-project"||command==="translate-project"){
    const sourcePath=process.argv[3];
    const targetPath=command==="translate-project"?process.argv[4]:undefined;
    const text=command==="translate-project"?process.argv[5]:process.argv[4];
    if(!sourcePath||!text||(command==="translate-project"&&!targetPath)){
      console.error("Error MISSING_ANALYSIS_ARGUMENT: Specify source pack, optional target pack, and a source sentence.");process.exitCode=1;return;
    }
    const source=await loadProject(sourcePath);
    if(!source.project){printDiagnostics(source.diagnostics);process.exitCode=1;return;}
    const analyzer=toAnalyzerProject(source.project);
    if(!analyzer.project){printDiagnostics(analyzer.diagnostics);process.exitCode=1;return;}
    const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,source.project.nodeGroups);
    const options={mode:"trace" as const,maxStepsPerStage:500};
    if(command==="analyze-project"){
      const result=analyzeSurface(analyzer.project,registry,text,options);
      if(!result.success){printDiagnostics(result.diagnostics);process.exitCode=1;return;}
      console.log(JSON.stringify({candidates:result.candidates,diagnostics:result.diagnostics},null,2));return;
    }
    const target=await loadProject(targetPath!);
    if(!target.project){printDiagnostics(target.diagnostics);process.exitCode=1;return;}
    const generator=toCompilerProject(target.project);
    if(!generator.project){printDiagnostics(generator.diagnostics);process.exitCode=1;return;}
    const candidateFlag=process.argv.find(x=>x.startsWith("--candidate="));
    const targetRegistry=new NodeRegistry();registerCorePrimitives(targetRegistry);registerPersistedNodeGroups(targetRegistry,target.project.nodeGroups);
    const result=translateSurface({sourceProject:analyzer.project,sourceRegistry:registry,targetProject:generator.project,targetRegistry,sourceLoaded:source.project,targetLoaded:target.project,text,candidateId:candidateFlag?.slice("--candidate=".length),options});
    if(!result.success||result.surface===undefined){
      printDiagnostics(result.diagnostics);
      if(result.needsSelection)console.error(`Select a candidate using --candidate=<ID>: ${result.candidates.map(c=>c.id).join(", ")}`);
      process.exitCode=1;return;
    }
    console.log(result.surface);return;
  }
  const loaded=await loadProject("examples/reference-language.vertax");
  if(!loaded.project){printDiagnostics(loaded.diagnostics);process.exitCode=1;return;}
  const adapted=toCompilerProject(loaded.project);
  if(!adapted.project){printDiagnostics(adapted.diagnostics);process.exitCode=1;return;}
  const canonical=loaded.project.tests["question-continuous"]?.input;
  if(!canonical){console.error("Error MISSING_CANONICAL_TEST: reference-language pack has no canonical input.");process.exitCode=1;return;}
  const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,loaded.project.nodeGroups);
  const result=compileMeaningGraph(adapted.project,registry,canonical as Parameters<typeof compileMeaningGraph>[2],{mode:command==="trace"?"trace":"fast",maxStepsPerStage:100});
  if(!result.success || !result.surface){printDiagnostics(result.diagnostics);process.exitCode=1;} else {
    console.log(result.surface);
    if(command==="trace") for(const step of result.trace) console.log(`${step.stage}: ${step.ruleId ?? "-"} — ${step.reason}`);
  }
}
await main();
