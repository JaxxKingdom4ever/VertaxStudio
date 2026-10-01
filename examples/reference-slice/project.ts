import type { CompilerProject } from "../../packages/compiler/src/index.js";
import type { CompilerValue, GrammarStructure, Morph, MorphSequence } from "../../packages/core-types/src/index.js";
import type { NodeRegistry } from "../../packages/runtime/src/index.js";
import { prefixMorph, rootMorph, type ProjectResources } from "../../packages/primitives/src/index.js";

const emptyFeatures={values:{}} as const;
const baseLexeme=(id:string,conceptId:string,lexicalClass:string,citation:string)=>({
  id, conceptId, lexicalClass, forms:{citation}, features:emptyFeatures, valency:[], relatedLexemes:{}, irregularRuleIds:[], metadata:{}
});

const resources: ProjectResources = {
  concepts: Object.fromEntries([
    ["PERSON","Person"],["QUESTION","Question"],["ACTIVE_RELATION","Active relation"],["CONTINUOUS","Continuous"],["COOK","Cook"],["COOKING","Cooking"],["FOOD","Food"]
  ].map(([id,label])=>[id,{id,label,metadata:{}}])),
  featureDefinitions: {},
  lexemes: {
    "lex-person": baseLexeme("lex-person","PERSON","noun","person"),
    "lex-vo": baseLexeme("lex-vo","QUESTION","operator","vo"),
    "lex-duru": baseLexeme("lex-duru","ACTIVE_RELATION","relational-verb","duru"),
    "lex-esi": baseLexeme("lex-esi","CONTINUOUS","aspect","esi"),
    "lex-cook": { ...baseLexeme("lex-cook","COOK","verb","cook"), valency:[
      {role:"agent",acceptedTypes:["Entity"],required:true,cardinality:"ONE"},
      {role:"theme",acceptedTypes:["Entity"],required:false,cardinality:"ONE"}
    ], relatedLexemes:{event_noun:["lex-cooking"]} },
    "lex-cooking": baseLexeme("lex-cooking","COOKING","event-noun","cooking"),
    "lex-food": baseLexeme("lex-food","FOOD","noun","food")
  },
  conceptToLexemeIds: {
    PERSON:["lex-person"], QUESTION:["lex-vo"], ACTIVE_RELATION:["lex-duru"], CONTINUOUS:["lex-esi"], COOK:["lex-cook"], COOKING:["lex-cooking"], FOOD:["lex-food"]
  },
  tables: {
    tense:{id:"tense",label:"Tense",columns:["semantic","morph"],rows:[{semantic:"present",morph:"ZERO"},{semantic:"past",morph:"PAST"}],metadata:{}}
  }
};

const inputPort=(types:readonly string[])=>({id:"value",direction:"input" as const,acceptedTypes:types,cardinality:"ONE" as const,required:true});
const outputPort=(types:readonly string[])=>({id:"value",direction:"output" as const,acceptedTypes:types,cardinality:"MANY" as const,required:true});

function lexemeForm(res:ProjectResources,id:string):string { return res.lexemes[id]?.forms.citation ?? ""; }
function candidate(id:string,lexemeId:string, extra:Readonly<Record<string,unknown>>={}):GrammarStructure {
  return {id,kind:"MorphCandidate",children:[],features:{values:{}},data:{lexemeId,...extra}};
}

export function registerReferenceSliceNodes(registry:NodeRegistry):void {
  registry.register({
    typeId:"ref.question-cook-grammar",
    inputs:[inputPort(["Event"])], outputs:[outputPort(["BoundUnit","MorphCandidate"])],
    evaluate:(ctx,inputs)=>{
      const event=inputs.value[0]!;
      if (!("roles" in event)) return {outputs:{value:[]},diagnostics:[{severity:"Error",code:"REF_EXPECTED_EVENT",message:"Expected semantic event."}]};
      const agentId=event.roles.agent?.[0]; const themeId=event.roles.theme?.[0];
      const agent=agentId?ctx.state.semanticGraph.objects[agentId]:undefined;
      const theme=themeId?ctx.state.semanticGraph.objects[themeId]:undefined;
      if(agent?.type!=="Unknown" || agent.conceptId!=="PERSON" || theme?.conceptId!=="FOOD") return {outputs:{value:[]},diagnostics:[{severity:"Error",code:"REF_UNSUPPORTED_MEANING",message:"Reference slice expects Unknown(Person) cooking FOOD."}]};
      const bound:GrammarStructure={id:"ref:01-agent-question",kind:"BoundUnit",children:[agent.id],features:{values:{}},data:{lexemeIds:["lex-person","lex-vo"]}};
      return {outputs:{value:[bound,candidate("ref:02-duru","lex-duru"),candidate("ref:03-cook","lex-cook",{prefixLexemeIds:["lex-esi"]}),candidate("ref:04-food","lex-food")]},diagnostics:[]};
    }
  });
  registry.register({
    typeId:"ref.to-morph",
    inputs:[inputPort(["BoundUnit","MorphCandidate"])], outputs:[outputPort(["MorphSequence"])],
    evaluate:(ctx,inputs)=>{
      const value=inputs.value[0] as GrammarStructure; const res=ctx.resources as ProjectResources;
      const data=value.data ?? {}; const morphs:Morph[]=[];
      const boundIds=Array.isArray(data.lexemeIds)?data.lexemeIds.map(String):[];
      if(boundIds.length){ for(const id of boundIds) morphs.push(rootMorph(lexemeForm(res,id))); }
      else {
        const prefixes=Array.isArray(data.prefixLexemeIds)?data.prefixLexemeIds.map(String):[];
        for(const id of prefixes) morphs.push(prefixMorph(lexemeForm(res,id)));
        const lexemeId=String(data.lexemeId??""); morphs.push(rootMorph(lexemeForm(res,lexemeId)));
      }
      const seq:MorphSequence={id:`morph:${value.id}`,morphs}; return {outputs:{value:[seq]},diagnostics:[]};
    }
  });
}

const grammarGraph={id:"ref-grammar-graph",nodes:[{id:"construct",typeId:"ref.question-cook-grammar",params:{}}],edges:[],exposedInputs:[{graphPortId:"value",nodeId:"construct",nodePortId:"value"}],exposedOutputs:[{graphPortId:"value",nodeId:"construct",nodePortId:"value"}]};
const morphGraph={id:"ref-morph-graph",nodes:[{id:"realize",typeId:"ref.to-morph",params:{}}],edges:[],exposedInputs:[{graphPortId:"value",nodeId:"realize",nodePortId:"value"}],exposedOutputs:[{graphPortId:"value",nodeId:"realize",nodePortId:"value"}]};
const surfaceGraph={id:"ref-surface-graph",nodes:[{id:"join",typeId:"surface.join",params:{separator:"'"}}],edges:[],exposedInputs:[{graphPortId:"value",nodeId:"join",nodePortId:"value"}],exposedOutputs:[{graphPortId:"value",nodeId:"join",nodePortId:"value"}]};

export const referenceSliceProject:CompilerProject={
  resources,
  grammar:{stage:"Grammar",graphs:{[grammarGraph.id]:grammarGraph},rules:[{id:"ref.bind-question-agent",stage:"Grammar",matcher:{kind:"all",matchers:[{kind:"type",type:"Event"},{kind:"featureEquals",featureId:"aspect",value:"continuous"},{kind:"roleExists",role:"agent"},{kind:"roleExists",role:"theme"}]},graphId:grammarGraph.id,priority:100,fallback:false}]},
  morphology:{stage:"Morphology",graphs:{[morphGraph.id]:morphGraph},rules:[{id:"ref.realize-morph",stage:"Morphology",matcher:{kind:"any",matchers:[{kind:"type",type:"BoundUnit"},{kind:"type",type:"MorphCandidate"}]},graphId:morphGraph.id,priority:100,fallback:false}]},
  surface:{stage:"Surface",graphs:{[surfaceGraph.id]:surfaceGraph},rules:[{id:"ref.surface-join",stage:"Surface",matcher:{kind:"type",type:"MorphSequence"},graphId:surfaceGraph.id,priority:100,fallback:false}]}
};
