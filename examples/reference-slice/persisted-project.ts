import type { LoadedVertaxProject } from "../../packages/project-model/src/index.js";
import { referenceSliceProject } from "./project.js";

const stageProjects=[referenceSliceProject.grammar,referenceSliceProject.morphology,referenceSliceProject.surface];
const stageDocuments=stageProjects.flatMap(stage=>Object.values(stage.graphs).map(graph=>({schema_version:1 as const,stage:stage.stage,graph,rules:stage.rules.filter(rule=>rule.graphId===graph.id)})));
const layouts=Object.fromEntries(stageDocuments.map(doc=>[doc.graph.id,{schema_version:1 as const,graph_id:doc.graph.id,nodes:Object.fromEntries(doc.graph.nodes.map((node,index)=>[node.id,{x:index*240,y:0}]))}]));

export const referencePersistedProject:LoadedVertaxProject={
  manifest:{
    schema_version:1,id:"reference-project",name:"Reference Slice",version:"0.1.0",default_language:"reference",
    graphs:{
      Grammar:["graphs/grammar/ref-grammar-graph.json"],
      Morphology:["graphs/morphology/ref-morph-graph.json"],
      Surface:["graphs/surface/ref-surface-graph.json"]
    },
    lexicons:["lexicon/lexicon.json"],features:["features/features.json"],concepts:["concepts/concepts.json"],
    tables:["tables/tense.json"],node_groups:[],tests:[],settings:"settings.json",
    layouts:Object.keys(layouts).sort().map(id=>`layouts/${id}.json`),dependencies:[]
  },
  concepts:referenceSliceProject.resources.concepts,
  features:referenceSliceProject.resources.featureDefinitions,
  lexemes:referenceSliceProject.resources.lexemes,
  tables:referenceSliceProject.resources.tables,
  stageDocuments,
  layouts,
  nodeGroups:{},tests:{},settings:{traceDefault:false}
};
