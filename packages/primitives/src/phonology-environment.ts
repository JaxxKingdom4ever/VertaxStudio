import type { PhonologicalToken } from '../../core-types/src/index.js';

export interface PhonologicalEnvironment {
 readonly target?:string;
 readonly left?:string;
 readonly right?:string;
 readonly crossMorpheme?:boolean;
 readonly crossSyllable?:boolean;
 readonly crossWord?:boolean;
}
const phoneme=(token:PhonologicalToken)=>token.kind==='Phoneme';
function mayCross(token:PhonologicalToken,env:PhonologicalEnvironment):boolean{
 if(token.kind!=='Boundary')return true;
 if(token.boundary==='Word')return env.crossWord===true;
 if(token.boundary==='Syllable')return env.crossSyllable===true;
 return env.crossMorpheme===true;
}
function neighbor(tokens:readonly PhonologicalToken[],start:number,direction:-1|1,env:PhonologicalEnvironment):string|undefined{
 for(let pos=start+direction;pos>=0&&pos<tokens.length;pos+=direction){
   const token=tokens[pos]!;
   if(token.kind==='Boundary'&&!mayCross(token,env))return undefined;
   if(token.kind==='Phoneme')return token.symbol;
 }
 return undefined;
}
export function matchingPhonemeIndices(tokens:readonly PhonologicalToken[],env:PhonologicalEnvironment):readonly number[]{
 const indices:number[]=[];
 for(let i=0;i<tokens.length;i++){
   const token=tokens[i]!;
   if(!phoneme(token)||token.kind!=='Phoneme'||(env.target!==undefined&&token.symbol!==env.target))continue;
   if(env.left!==undefined&&neighbor(tokens,i,-1,env)!==env.left)continue;
   if(env.right!==undefined&&neighbor(tokens,i,1,env)!==env.right)continue;
   indices.push(i);
 }
 return indices;
}
export const adjacentPhoneme=(tokens:readonly PhonologicalToken[],index:number,direction:-1|1,env:PhonologicalEnvironment):string|undefined=>neighbor(tokens,index,direction,env);
