import { validateSemanticGraph, type Diagnostic, type SemanticGraph, type SemanticObject, type StableId } from '../../core-types/src/index.js';
export interface MeaningEditResult {readonly graph:SemanticGraph;readonly diagnostics:readonly Diagnostic[];}
const fail=(code:string,message:string):readonly Diagnostic[]=>[{severity:'Error',code,message}];
export const createEmptyMeaningGraph=():SemanticGraph=>({objects:{},roots:[]});
export function addSemanticObject(graph:SemanticGraph,object:SemanticObject):MeaningEditResult{
 if(graph.objects[object.id])return {graph,diagnostics:fail('DUPLICATE_SEMANTIC_OBJECT',`Object ${object.id} already exists.`)};
 const next={objects:{...graph.objects,[object.id]:structuredClone(object)},roots:[...graph.roots]};
 const diagnostics=validateSemanticGraph(next);
 return diagnostics.length?{graph,diagnostics}:{graph:next,diagnostics:[]};
}
export function updateSemanticObject(graph:SemanticGraph,id:StableId,patch:Partial<Pick<SemanticObject,'conceptId'|'features'>>):MeaningEditResult{
 const old=graph.objects[id];if(!old)return {graph,diagnostics:fail('UNKNOWN_SEMANTIC_OBJECT',`Missing ${id}.`)};
 const next={...graph,objects:{...graph.objects,[id]:{...old,...structuredClone(patch)}}};
 return {graph:next,diagnostics:[]};
}
export function setSemanticRole(graph:SemanticGraph,sourceId:StableId,role:string,targetIds:readonly StableId[]):MeaningEditResult{
 const source=graph.objects[sourceId];if(!source)return {graph,diagnostics:fail('UNKNOWN_SEMANTIC_OBJECT',`Missing ${sourceId}.`)};
 if(!role.trim())return {graph,diagnostics:fail('INVALID_SEMANTIC_ROLE','Role cannot be empty.')};
 for(const id of targetIds)if(!graph.objects[id])return {graph,diagnostics:fail('MISSING_SEMANTIC_REFERENCE',`${sourceId} references missing ${id}.`)};
 return {graph:{...graph,objects:{...graph.objects,[sourceId]:{...source,roles:{...source.roles,[role]:[...targetIds]}}}},diagnostics:[]};
}
export function setSemanticRoots(graph:SemanticGraph,ids:readonly StableId[]):MeaningEditResult{
 for(const id of ids)if(!graph.objects[id])return {graph,diagnostics:fail('MISSING_SEMANTIC_ROOT',`Missing semantic root ${id}.`)};
 return {graph:{...graph,roots:[...new Set(ids)]},diagnostics:[]};
}
export function removeSemanticObject(graph:SemanticGraph,id:StableId):MeaningEditResult{
 if(!graph.objects[id])return {graph,diagnostics:fail('UNKNOWN_SEMANTIC_OBJECT',`Missing ${id}.`)};
 const objects:Record<string,SemanticObject>={};
 for(const [key,item] of Object.entries(graph.objects)){
   if(key===id)continue;
   const roles=Object.fromEntries(Object.entries(item.roles).map(([role,ids])=>[role,ids.filter(ref=>ref!==id)]));
   objects[key]={...item,roles};
 }
 return {graph:{objects,roots:graph.roots.filter(ref=>ref!==id)},diagnostics:[]};
}
