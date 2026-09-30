import type {LoadedVertaxProject} from '../../../packages/project-model/src/index.js';
import {NodeRegistry} from '../../../packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../packages/primitives/src/index.js';
import {registerPersistedNodeGroups} from '../../../packages/project-model/src/node-group-runtime.js';
import {runPersistedPackTests,type PersistedTestReport} from '../../../packages/translation/src/index.js';
export function runProjectTestsInStudio(project:LoadedVertaxProject):PersistedTestReport {
 const registry=new NodeRegistry();registerCorePrimitives(registry);registerPersistedNodeGroups(registry,project.nodeGroups);
 return runPersistedPackTests(project,registry,{mode:'fast',maxStepsPerStage:200});
}
export function renderLabTests(container:HTMLElement,project:LoadedVertaxProject):void{
 container.replaceChildren();const header=document.createElement('h3');header.textContent=`Project tests · ${Object.keys(project.tests).length}`;container.append(header);
 const run=document.createElement('button');run.textContent='Run all project tests';run.className='lab-run-tests';container.append(run);
 const result=document.createElement('div');result.className='lab-test-results';container.append(result);
 run.onclick=()=>{const report=runProjectTestsInStudio(project);result.replaceChildren();
   const heading=document.createElement('p');heading.textContent=`${report.passed}/${report.total} passing`;result.append(heading);
   for(const failure of report.failures){const item=document.createElement('p');item.className='lab-test-failure';item.textContent=`${failure.id}: ${failure.message}`;result.append(item)}
 };
 const list=document.createElement('ol');list.className='lab-tests-list';for(const test of Object.values(project.tests).sort((a,b)=>a.id.localeCompare(b.id))){const item=document.createElement('li');item.textContent=`${test.name} (${test.input_stage} → ${test.expected_stage})`;list.append(item)}container.append(list);
}
