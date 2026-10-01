import type { SemanticGraph, StableId } from '../../core-types/src/index.js';
export interface MeaningTreeNode {readonly objectId:StableId;readonly role?:string;readonly repeated:boolean;readonly cyclic:boolean;readonly children:readonly MeaningTreeNode[];}
export function buildMeaningTree(graph:SemanticGraph):readonly MeaningTreeNode[]{
 const seen=new Set<StableId>();
 const walk=(id:StableId,ancestry:ReadonlySet<StableId>,role?:string):MeaningTreeNode=>{
   const cyclic=ancestry.has(id),repeated=seen.has(id);
   if(cyclic||repeated||!graph.objects[id])return {objectId:id,role,repeated,cyclic,children:[]};
   seen.add(id);
   const next=new Set(ancestry);next.add(id);
   const children=Object.entries(graph.objects[id]!.roles).sort(([a],[b])=>a.localeCompare(b)).flatMap(([name,ids])=>ids.map(child=>walk(child,next,name)));
   return {objectId:id,role,repeated:false,cyclic:false,children};
 };
 return graph.roots.map(id=>walk(id,new Set()));
}
