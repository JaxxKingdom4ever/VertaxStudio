import type {Diagnostic} from '../../core-types/src/index.js';
import type {LoadedVertaxProject,PersistedTestDocument} from '../../project-model/src/index.js';
import type {SentenceLabState} from './model.js';
export interface SaveLabTestResult { readonly project:LoadedVertaxProject;readonly diagnostics:readonly Diagnostic[]; }
export function saveSentenceLabTest(project:LoadedVertaxProject,state:SentenceLabState,metadata:{id:string;name:string}):SaveLabTestResult{
 const fail=(code:string,message:string):SaveLabTestResult=>({project,diagnostics:[{severity:'Error',code,message}]});
 if(!/^[A-Za-z0-9_-]+$/.test(metadata.id))return fail('INVALID_TEST_ID','Use only letters, digits, underscores and hyphens for test IDs.');
 if(project.tests[metadata.id])return fail('DUPLICATE_TEST_ID',`Test ${metadata.id} already exists.`);
 if(!state.result?.success || state.result.surface===undefined)return fail('NO_COMPILED_OUTPUT','Compile a confirmed MeaningGraph before saving a test.');
 const test:PersistedTestDocument={schema_version:1,id:metadata.id,name:metadata.name,input_stage:'Meaning',input:structuredClone(state.meaningGraph),expected_stage:'Surface',expected_output:{surface:state.result.surface},mode:state.compileMode,assertions:[]};
 return {project:{...project,tests:{...project.tests,[test.id]:test}},diagnostics:[]};
}
