import type {NodeParameterDescriptor} from '../../../packages/runtime/src/index.js';
export function parseTypedParameter(descriptor:NodeParameterDescriptor,value:string|boolean,tableIds:readonly string[]=[]):unknown{
 switch(descriptor.kind){
   case 'text':return String(value);
   case 'boolean':return value===true;
   case 'number':{
     const num=Number(value);if(!String(value).trim()||!Number.isFinite(num))throw new Error(`${descriptor.label} must be a finite number.`);
     return num;
   }
   case 'select':{
     if(descriptor.options?.length&&!descriptor.options.includes(String(value)))throw new Error(`${descriptor.label} must be one of ${descriptor.options.join(', ')}.`);
     return String(value);
   }
   case 'table':{
     if(value && !tableIds.includes(String(value)))throw new Error(`Unknown table ${value}.`);
     return String(value);
   }
   case 'json':{
     try{return JSON.parse(String(value))}catch{throw new Error(`${descriptor.label} must be valid JSON.`)}
   }
 }
}
