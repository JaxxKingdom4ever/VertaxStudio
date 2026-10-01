import type { MorphSequence, PhonologicalForm, PhonologicalToken } from "../../core-types/src/index.js";
import { registerPhonologicalRulePrimitives } from "./phonology-rules.js";
import { spellPhonologicalForm } from "./surface-form.js";
import type { ProjectResources } from "./project-resources.js";
import type { NodeRegistry } from "../../runtime/src/index.js";

export function registerPhonologyPrimitives(registry:NodeRegistry):void {
  registerPhonologicalRulePrimitives(registry);
  registry.register({
    typeId:"phon.from-morphs",
    inputs:[{id:"value",direction:"input",acceptedTypes:["MorphSequence"],cardinality:"ONE",required:true}],
    outputs:[{id:"value",direction:"output",acceptedTypes:["PhonologicalForm"],cardinality:"ONE",required:true}],
    evaluate:(_context,inputs)=>{
      const morph=inputs.value[0] as MorphSequence;
      const tokens:PhonologicalToken[]=[];
      const zeroMorphIds:string[]=[];
      for(const item of morph.morphs){
        if(item.kind==="Zero"){zeroMorphIds.push(item.id);continue;}
        if(tokens.length){
          tokens.push({kind:"Boundary",boundary:item.boundaryBefore===""?"Affix":"Morpheme",sourceMorphId:item.id});
        }
        for(const symbol of [...item.form])tokens.push({kind:"Phoneme",symbol,sourceMorphId:item.id,sourceObjectId:item.sourceObjectId});
      }
      return {outputs:{value:[{id:`phon:${morph.id}`,valueType:"PhonologicalForm",tokens,zeroMorphIds}]},diagnostics:[]};
    }
  });
  registry.register({
    typeId:"phon.output",
    inputs:[{id:"value",direction:"input",acceptedTypes:["PhonologicalForm"],cardinality:"ONE",required:true}],
    outputs:[{id:"value",direction:"output",acceptedTypes:["PhonologicalForm"],cardinality:"ONE",required:true}],
    evaluate:(_context,inputs)=>({outputs:{value:inputs.value},diagnostics:[]})
  });
  registry.register({
    typeId:"surface.spell",
    inputs:[{id:"value",direction:"input",acceptedTypes:["PhonologicalForm"],cardinality:"ONE",required:true}],
    outputs:[{id:"value",direction:"output",acceptedTypes:["SurfaceForm"],cardinality:"ONE",required:true}],
    evaluate:(context,inputs,params)=>{
      const result=spellPhonologicalForm(inputs.value[0] as PhonologicalForm,context.resources as ProjectResources|undefined,params,context.nodeId);
      return result.value?{outputs:{value:[result.value]},diagnostics:[]}:{outputs:{value:[]},diagnostics:[{severity:'Error',code:result.error?.startsWith('Missing spelling')?'MISSING_SPELLING_TABLE':'UNMAPPED_PHONEME',message:result.error??'Invalid spelling rule.'}]};

    }
  });
}
