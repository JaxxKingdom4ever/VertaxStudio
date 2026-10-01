import {compileMeaningGraph} from '../../compiler/src/index.js';
import {validateSemanticGraph} from '../../core-types/src/index.js';
import {NodeRegistry,type NodeDefinition} from '../../runtime/src/index.js';
import {registerCorePrimitives} from '../../primitives/src/index.js';
import {registerPersistedNodeGroups} from '../../project-model/src/node-group-runtime.js';
import {toCompilerProject} from '../../project-model/src/compiler-adapter.js';
import type {LoadedVertaxProject} from '../../project-model/src/model.js';
import type {SentenceLabState} from './model.js';
import {findFirstBreakpointHit} from './debugger.js';
export function createRegistryFromDefinitions(definitions:readonly NodeDefinition[]):NodeRegistry{
 const registry=new NodeRegistry();registerCorePrimitives(registry);
 for(const def of definitions)if(!registry.get(def.typeId))registry.register(def);
 return registry;
}
export function compileSentenceLab(project:LoadedVertaxProject,definitions:readonly NodeDefinition[],state:SentenceLabState):SentenceLabState {
 const semanticDiagnostics=validateSemanticGraph(state.meaningGraph);
 if(semanticDiagnostics.length)return {...state,result:undefined,diagnostics:semanticDiagnostics,traceCursor:undefined};
 if(state.meaningGraph.roots.length===0)return {...state,result:undefined,diagnostics:[{severity:'Error',code:'EMPTY_MEANING_GRAPH',message:'Confirm at least one semantic root before compiling.'}],traceCursor:undefined};
 const adapter=toCompilerProject(project);
 if(!adapter.project)return {...state,result:undefined,diagnostics:adapter.diagnostics,traceCursor:undefined};
 const registry=createRegistryFromDefinitions(definitions);
 registerPersistedNodeGroups(registry,project.nodeGroups);
 const result=compileMeaningGraph(adapter.project,registry,state.meaningGraph,{mode:state.compileMode,maxStepsPerStage:state.maxStepsPerStage});
 return {...state,result,diagnostics:result.diagnostics,traceCursor:result.debugFrames.length?(findFirstBreakpointHit(result.debugFrames,state.breakpoints)??0):undefined};
}
