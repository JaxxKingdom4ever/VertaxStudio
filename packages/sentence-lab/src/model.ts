import type { CompileResult } from '../../compiler/src/index.js';
import type { Diagnostic, SemanticGraph, StableId } from '../../core-types/src/index.js';
import {createEmptyMeaningGraph} from './meaning-edit.js';
export type MeaningComposerView='Form'|'Tree'|'Graph';
export type SentenceLabOutputView='Final'|'Gloss'|'Structure'|'Trace'|'Errors';
export interface SentenceLabState {
 readonly sourceText:string;
 readonly meaningGraph:SemanticGraph;
 readonly composerView:MeaningComposerView;
 readonly outputView:SentenceLabOutputView;
 readonly compileMode:'fast'|'trace'|'strict';
 readonly maxStepsPerStage:number;
 readonly result?:CompileResult;
 readonly traceCursor?:number;
 readonly selectedValueId?:StableId;
 readonly breakpoints:readonly StableId[];
 readonly diagnostics:readonly Diagnostic[];
}
export function createSentenceLabState(initialGraph:SemanticGraph=createEmptyMeaningGraph()):SentenceLabState{
 return {sourceText:'',meaningGraph:initialGraph,composerView:'Form',outputView:'Final',compileMode:'trace',maxStepsPerStage:200,breakpoints:[],diagnostics:[]};
}
export const withSourceText=(state:SentenceLabState,sourceText:string):SentenceLabState=>({...state,sourceText});
export const withMeaningGraph=(state:SentenceLabState,meaningGraph:SemanticGraph):SentenceLabState=>({...state,meaningGraph,result:undefined,traceCursor:undefined});
export const withComposerView=(state:SentenceLabState,composerView:MeaningComposerView):SentenceLabState=>({...state,composerView});
export const withOutputView=(state:SentenceLabState,outputView:SentenceLabOutputView):SentenceLabState=>({...state,outputView});
export const withTraceCursor=(state:SentenceLabState,traceCursor:number):SentenceLabState=>({...state,traceCursor:Math.max(0,Math.min(traceCursor,(state.result?.debugFrames.length??1)-1))});
export const withSelectedValue=(state:SentenceLabState,selectedValueId?:StableId):SentenceLabState=>({...state,selectedValueId});
export const setBreakpoint=(state:SentenceLabState,nodeId:StableId,enabled:boolean):SentenceLabState=>({...state,breakpoints:enabled?[...new Set([...state.breakpoints,nodeId])]:state.breakpoints.filter(id=>id!==nodeId)});
