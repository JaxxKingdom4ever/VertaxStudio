import type { CompilerValue, GrammarStructure } from "../../core-types/src/index.js";
import type { NodeRegistry } from "../../runtime/src/index.js";
import { findLexemeByConcept } from "./lexicon.js";
import type { ProjectResources } from "./project-resources.js";

const allTypes=["Entity","Group","Event","State","Property","Relation","Quantity","Proposition","Unknown","Reference","Modality","SemanticList","Clause","Phrase","OrderedGroup","BoundUnit","ArgumentFrame","ListStructure","DeferredStructure","MorphCandidate","MorphSequence","SurfaceForm"];
const out=(types:readonly string[])=>({id:"value",direction:"output" as const,acceptedTypes:types,cardinality:"ONE" as const,required:true});
export function registerGrammarPrimitives(registry:NodeRegistry):void {
  registry.register({typeId:"grammar.order",inputs:[{id:"values",direction:"input",acceptedTypes:allTypes,cardinality:"MANY",required:true}],outputs:[out(["OrderedGroup"])],evaluate:(_c,i)=>({outputs:{value:[{id:`order:${i.values.map(v=>v.id).join(":")}`,kind:"OrderedGroup",children:i.values.map(v=>v.id),features:{values:{}},data:{members:i.values}}]},diagnostics:[]})});
  registry.register({typeId:"grammar.bind",inputs:[{id:"left",direction:"input",acceptedTypes:allTypes,cardinality:"ONE",required:true},{id:"right",direction:"input",acceptedTypes:allTypes,cardinality:"ONE",required:true}],outputs:[out(["BoundUnit"])],evaluate:(_c,i)=>({outputs:{value:[{id:`bind:${i.left[0]!.id}:${i.right[0]!.id}`,kind:"BoundUnit",children:[i.left[0]!.id,i.right[0]!.id],features:{values:{}},data:{members:[i.left[0],i.right[0]]}}]},diagnostics:[]})});
  registry.register({typeId:"grammar.lookup-lexeme",inputs:[{id:"value",direction:"input",acceptedTypes:allTypes,cardinality:"ONE",required:true}],outputs:[out(["MorphCandidate"])],evaluate:(c,i,p)=>{
    const v=i.value[0]!; const conceptId="conceptId" in v?v.conceptId:undefined; const resources=c.resources as ProjectResources|undefined;
    const lexeme=conceptId&&resources?findLexemeByConcept(resources,conceptId,String(p.lexicalClass??"" )||undefined):undefined;
    if(!lexeme) return {outputs:{value:[]},diagnostics:[{severity:"Error",code:"MISSING_LEXEME",message:`No lexeme for concept ${conceptId??"unknown"}.`,objectId:v.id}]};
    const g:GrammarStructure={id:`lex:${v.id}:${lexeme.id}`,kind:"MorphCandidate",children:[],features:"features" in v?v.features:{values:{}},data:{lexemeId:lexeme.id,form:lexeme.forms.citation??Object.values(lexeme.forms)[0]??""}};
    return {outputs:{value:[g]},diagnostics:[]};
  }});
}
