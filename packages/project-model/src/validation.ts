import type { Diagnostic, StableId } from "../../core-types/src/index.js";
import { buildProjectResources } from "./resources.js";
import type { LoadedVertaxProject } from "./model.js";
import type { GraphDefinition } from "../../runtime/src/index.js";
function d(severity:Diagnostic["severity"],code:string,message:string,objectId?:StableId):Diagnostic{return {severity,code,message,objectId}}
export function validateProject(project:LoadedVertaxProject):readonly Diagnostic[]{
  const diagnostics:Diagnostic[]=[]; const owners=new Map<StableId,string>();
  const add=(id:StableId,kind:string)=>{const prev=owners.get(id);if(prev)diagnostics.push(d("Error","DUPLICATE_STABLE_ID",`Stable ID ${id} is used by both ${prev} and ${kind}.`,id));else owners.set(id,kind)};
  for(const id of Object.keys(project.concepts))add(id,"concept");
  for(const id of Object.keys(project.features))add(id,"feature");
  for(const id of Object.keys(project.lexemes))add(id,"lexeme");
  for(const id of Object.keys(project.tables))add(id,"table");
  for(const doc of project.stageDocuments)add(doc.graph.id,"graph");
  for(const id of Object.keys(project.nodeGroups))add(id,"node-group");
  for(const id of Object.keys(project.tests))add(id,"test");
  const graphById=new Map(project.stageDocuments.map(doc=>[doc.graph.id,doc]));
  for(const doc of project.stageDocuments){
    for(const rule of doc.rules){
      const target=graphById.get(rule.graphId); if(!target)diagnostics.push(d("Error","MISSING_RULE_GRAPH_REFERENCE",`Rule ${rule.id} references missing graph ${rule.graphId}.`,rule.id));
      if(rule.stage!==doc.stage)diagnostics.push(d("Error","RULE_STAGE_MISMATCH",`Rule ${rule.id} is ${rule.stage} inside ${doc.stage} document.`,rule.id));
      if(target&&target.stage!==rule.stage)diagnostics.push(d("Error","RULE_GRAPH_STAGE_MISMATCH",`Rule ${rule.id} targets ${target.stage} graph ${target.graph.id}.`,rule.id));
    }
  }
  for(const layout of Object.values(project.layouts)){
    const graphDoc=graphById.get(layout.graph_id); if(!graphDoc){diagnostics.push(d("Error","MISSING_LAYOUT_GRAPH_REFERENCE",`Layout references missing graph ${layout.graph_id}.`,layout.graph_id));continue;}
    const nodeIds=new Set(graphDoc.graph.nodes.map(n=>n.id)); for(const nodeId of Object.keys(layout.nodes))if(!nodeIds.has(nodeId))diagnostics.push(d("Warning","MISSING_LAYOUT_NODE_REFERENCE",`Layout for graph ${layout.graph_id} contains missing node ${nodeId}.`,nodeId));
  }

  const checkGraph=(graph:GraphDefinition):void=>{
    const ids=new Set<string>();
    for(const node of graph.nodes){
      if(ids.has(node.id))diagnostics.push(d("Error","DUPLICATE_GRAPH_NODE_ID",`Graph ${graph.id} declares node ${node.id} more than once.`,node.id));
      ids.add(node.id);
      if(node.typeId.startsWith("node-group:") && !project.nodeGroups[node.typeId.slice("node-group:".length)]){
        diagnostics.push(d("Error","MISSING_NODE_GROUP_REFERENCE",`Graph ${graph.id} references unknown Node Group ${node.typeId}.`,node.id));
      }
    }
    for(const edge of graph.edges){
      if(!ids.has(edge.sourceNodeId)||!ids.has(edge.targetNodeId))diagnostics.push(d("Error","MISSING_GRAPH_EDGE_NODE",`Graph ${graph.id} has an edge with missing endpoint ${edge.sourceNodeId} → ${edge.targetNodeId}.`,graph.id));
    }
    for(const binding of [...graph.exposedInputs,...graph.exposedOutputs]){
      if(!ids.has(binding.nodeId))diagnostics.push(d("Error","MISSING_GRAPH_BINDING_NODE",`Graph ${graph.id} binds ${binding.graphPortId} to missing node ${binding.nodeId}.`,graph.id));
    }
  };
  for(const document of project.stageDocuments)checkGraph(document.graph);
  for(const group of Object.values(project.nodeGroups))checkGraph(group.internal_graph);
  const resources=buildProjectResources({concepts:Object.values(project.concepts),features:Object.values(project.features),lexemes:Object.values(project.lexemes),tables:Object.values(project.tables)});diagnostics.push(...resources.diagnostics);
  for(const group of Object.values(project.nodeGroups))for(const testId of group.test_ids)if(!project.tests[testId])diagnostics.push(d("Error","MISSING_NODE_GROUP_TEST_REFERENCE",`Node Group ${group.id} references missing test ${testId}.`,group.id));
  return diagnostics;
}
