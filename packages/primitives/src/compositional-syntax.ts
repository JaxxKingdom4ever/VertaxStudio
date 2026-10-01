import type {Diagnostic,LexicalOption,MorphAnalysis,SemanticObject,SyntacticAnalysis} from '../../core-types/src/index.js';

/** A category matches a completed constituent; terminals inspect lexical options at one source token. */
interface Terminal {readonly text?:string;readonly classes?:readonly string[];readonly formKeys?:readonly string[];readonly conceptIds?:readonly string[];readonly lexemeIds?:readonly string[];}
type Symbol = {readonly category:string;readonly terminal?:never}|{readonly terminal:Terminal;readonly category?:never};
interface ObjectTemplate {readonly id:string;readonly type:SemanticObject['type'];readonly conceptId?:string;readonly slot?:number;readonly roles?:Readonly<Record<string,readonly string[]>>;readonly features?:Readonly<Record<string,unknown>>;}
interface RoleAugment {readonly target:string;readonly role:string;readonly value:string;}
interface FeatureAugment {readonly target:string;readonly values:Readonly<Record<string,unknown>>;}
interface SemanticTemplate {readonly root:string;readonly objects:readonly ObjectTemplate[];readonly augmentRoles?:readonly RoleAugment[];readonly augmentFeatures?:readonly FeatureAugment[];}
interface Rule {readonly id:string;readonly lhs:string;readonly rhs:readonly Symbol[];readonly meaning:SemanticTemplate;readonly head?:number;readonly headConstraint?:Readonly<{readonly left:number;readonly right:number;readonly allowedPairs:readonly (readonly [string,string])[]}>;}
export interface CompositionalGrammar {readonly startSymbol:string;readonly rules:readonly Rule[];readonly maxResults?:number;readonly maxItems?:number;}
export interface CompositionResult {readonly analyses:readonly SyntacticAnalysis[];readonly diagnostics:readonly Diagnostic[];}
interface Capture extends LexicalOption {readonly token:MorphAnalysis['tokens'][number]['token'];}
interface BuiltObject extends ObjectTemplate {readonly id:string;readonly slot?:number;}
interface Built {
 readonly id:string;readonly root:string;readonly start:number;readonly end:number;
 readonly objects:readonly BuiltObject[];readonly captures:Readonly<Record<string,Capture>>;readonly head?:Capture;
}
const fail=(code:string,message:string):Diagnostic=>({severity:'Error',code,message});
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const isRef=(v:unknown):v is string=>typeof v==='string'&&v.length>0;
function validGrammar(g:unknown):g is CompositionalGrammar {
 if(!rec(g)||!isRef(g.startSymbol)||!Array.isArray(g.rules)||g.rules.length===0)return false;
 if(g.maxResults!==undefined&&(!Number.isInteger(g.maxResults)||!(g.maxResults as number>0)))return false;
 if(g.maxItems!==undefined&&(!Number.isInteger(g.maxItems)||!(g.maxItems as number>0)))return false;
 const ids=new Set<string>();
 for(const r of g.rules){
  if(!rec(r)||!isRef(r.id)||ids.has(r.id)||!isRef(r.lhs)||!Array.isArray(r.rhs)||r.rhs.length===0||!rec(r.meaning)||!isRef(r.meaning.root)||!Array.isArray(r.meaning.objects))return false;
  ids.add(r.id);
  if(!r.rhs.every((s:unknown)=>(rec(s)&&((isRef(s.category)&&s.terminal===undefined)||(rec(s.terminal)&&s.category===undefined)))))return false;
  if(!r.meaning.objects.every((o:unknown)=>rec(o)&&isRef(o.id)&&isRef(o.type)&&(o.slot===undefined||Number.isInteger(o.slot))))return false;
  if(r.head!==undefined&&(!Number.isInteger(r.head)||(r.head as number)<0||(r.head as number)>=r.rhs.length))return false;
  if(r.meaning.augmentRoles!==undefined&&(!Array.isArray(r.meaning.augmentRoles)||!r.meaning.augmentRoles.every((a:unknown)=>rec(a)&&isRef(a.target)&&isRef(a.value)&&isRef(a.role))))return false;
  if(r.meaning.augmentFeatures!==undefined&&(!Array.isArray(r.meaning.augmentFeatures)||!r.meaning.augmentFeatures.every((a:unknown)=>rec(a)&&isRef(a.target)&&rec(a.values))))return false;
 }
 return true;
}
function hasUnitCycle(rules:readonly Rule[]):boolean {
 const adjacency=new Map<string,string[]>();
 for(const rule of rules)if(rule.rhs.length===1&&rule.rhs[0]?.category){
  const list=adjacency.get(rule.lhs)??[];list.push(rule.rhs[0].category!);adjacency.set(rule.lhs,list);
 }
 const visiting=new Set<string>(),visited=new Set<string>();
 const walk=(category:string):boolean=>{
  if(visiting.has(category))return true;if(visited.has(category))return false;
  visiting.add(category);
  for(const next of adjacency.get(category)??[])if(walk(next))return true;
  visiting.delete(category);visited.add(category);return false;
 };
 return [...adjacency.keys()].some(walk);
}
function lexicalChoices(token:MorphAnalysis['tokens'][number],slot:Terminal):readonly Capture[] {
 if(slot.text!==undefined&&slot.text.toLowerCase()!==token.token.normalized)return [];
 const constrained=[slot.classes,slot.formKeys,slot.conceptIds,slot.lexemeIds].some(v=>v?.length);
 if(!constrained)return [{lexemeId:'surface:literal',conceptId:'sem:literal',lexicalClass:'Literal',formKey:'citation',token:token.token}];
 return token.options.filter(opt=>(!slot.classes?.length||slot.classes.includes(opt.lexicalClass))&&
  (!slot.formKeys?.length||slot.formKeys.includes(opt.formKey))&&
  (!slot.conceptIds?.length||slot.conceptIds.includes(opt.conceptId))&&
  (!slot.lexemeIds?.length||slot.lexemeIds.includes(opt.lexemeId))).map(opt=>({...opt,token:token.token}));
}
/**
 * Bounded, deterministic bottom-up chart analysis. All syntax rules and semantic actions are data,
 * including attachment ambiguity and recursive, consuming phrase constructions. Empty productions
 * and unary category cycles are rejected; item limits fail closed rather than silently pruning meaning.
 */
export function composeSyntaxPatterns(input:MorphAnalysis,grammar:CompositionalGrammar):CompositionResult {
 if(!validGrammar(grammar))return {analyses:[],diagnostics:[fail('INVALID_COMPOSITION_GRAMMAR','Expected nonempty, serializable compositional grammar with typed symbols.')]};
 if(hasUnitCycle(grammar.rules))return {analyses:[],diagnostics:[fail('ANALYSIS_GRAMMAR_CYCLE','Unary category productions contain a non-consuming cycle.')]};
 const n=input.tokens.length,maxResults=grammar.maxResults??128,maxItems=grammar.maxItems??12000;
 const chart=new Map<string,Map<string,Built>>();let itemCount=0,exhausted=false;
 const key=(cat:string,s:number,e:number)=>`${cat}\u0000${s}\u0000${e}`;
 const read=(cat:string,s:number,e:number)=>[...(chart.get(key(cat,s,e))?.values()??[])];
 const insert=(cat:string,s:number,e:number,item:Built)=>{
  const k=key(cat,s,e);let cell=chart.get(k);if(!cell){cell=new Map();chart.set(k,cell);}
  if(cell.has(item.id))return false;
  if(itemCount>=maxItems){exhausted=true;return false;}
  cell.set(item.id,item);itemCount++;return true;
 };
 type Child=Built&{readonly terminal?:boolean;readonly choice?:Capture};
 const matchParts=(rhs:readonly Symbol[],s:number,e:number):Child[][]=>{
  const results:Child[][]=[];
  const run=(pos:number,cursor:number,acc:Child[]):void=>{
   if(exhausted)return;
   if(pos===rhs.length){if(cursor===e)results.push([...acc]);return;}
   const symbol=rhs[pos]!;
   const remaining=rhs.length-pos-1;
   if(symbol.terminal){
    if(cursor>=e||e-cursor<remaining+1)return;
    for(const choice of lexicalChoices(input.tokens[cursor]!,symbol.terminal)){
     const part:Child={id:`token:${cursor}:${choice.lexemeId}:${choice.formKey}`,root:'',start:cursor,end:cursor+1,objects:[],captures:{[String(cursor)]:choice},head:choice,terminal:true,choice};
     run(pos+1,cursor+1,[...acc,part]);
    }
   }else if(symbol.category){
    for(let stop=cursor+1;stop<=e-remaining;stop++)for(const child of read(symbol.category,cursor,stop))run(pos+1,stop,[...acc,child]);
   }
  };
  run(0,s,[]);return results;
 };
 const build=(rule:Rule,start:number,end:number,children:Child[]):Built|null=>{
  const refs=(value:string):string=>value.startsWith('$')?
   (Number.isInteger(Number(value.slice(1)))?children[Number(value.slice(1))]?.root??'': ''):`${rule.id}@${start}:${end}.${value}`;
  const objects:BuiltObject[]=children.flatMap(c=>c.objects.map(o=>({...o,roles:o.roles?Object.fromEntries(Object.entries(o.roles).map(([r,vs])=>[r,[...vs]])):undefined,features:o.features?{...o.features}:undefined})));
  const captures:Object=Object.assign({},...children.map(c=>c.captures));
  for(const obj of rule.meaning.objects){
   const c=obj.slot===undefined?undefined:children[obj.slot];
   if(obj.slot!==undefined&&(!c||!c.terminal))return null;
   const id=refs(obj.id);
   objects.push({...obj,id,slot:c?.start,roles:obj.roles?Object.fromEntries(Object.entries(obj.roles).map(([role,ids])=>[role,ids.map(refs)])):undefined});
  }
  const byId=new Map(objects.map((o,i)=>[o.id,i]));
  for(const op of rule.meaning.augmentRoles??[]){
   const id=refs(op.target),referent=refs(op.value),index=byId.get(id);
   if(index===undefined||!referent)return null;
   const object=objects[index]!;
   objects[index]={...object,roles:{...object.roles,[op.role]:[...object.roles?.[op.role]??[],referent]}};
  }
  for(const op of rule.meaning.augmentFeatures??[]){
   const index=byId.get(refs(op.target));if(index===undefined)return null;
   const object=objects[index]!;objects[index]={...object,features:{...object.features,...op.values}};
  }
  const root=refs(rule.meaning.root);
  if(!root||!byId.has(root))return null;
  const head=children[rule.head??0]?.head;
  return {id:`${rule.id}@${start}:${end}(${children.map(c=>c.id).join('|')})`,root,start,end,objects,captures:captures as Record<string,Capture>,head};
 };
 for(let width=1;width<=n&&!exhausted;width++)for(let start=0;start+width<=n&&!exhausted;start++){
  const end=start+width;
  let changed=true;
  let iterations=0;
  while(changed&&!exhausted){
   changed=false;
   if(++iterations>grammar.rules.length+2){exhausted=true;break;}
   for(const rule of grammar.rules){
    if(rule.rhs.length>width)continue;
    for(const parts of matchParts(rule.rhs,start,end)){
     if(rule.headConstraint){const {left,right,allowedPairs}=rule.headConstraint;
      if(!allowedPairs.some(([a,b])=>parts[left]?.head?.formKey===a&&parts[right]?.head?.formKey===b))continue;}
     const candidate=build(rule,start,end,parts);
     if(candidate&&insert(rule.lhs,start,end,candidate))changed=true;
     if(exhausted)break;
    }
    if(exhausted)break;
   }
  }
 }
 if(exhausted)return {analyses:[],diagnostics:[fail('ANALYSIS_PARSE_BUDGET',`Chart parser exceeded ${maxItems} derivations or its progress limit.`)]};
 const results=read(grammar.startSymbol,0,n);
 if(results.length>maxResults)return {analyses:[],diagnostics:[fail('ANALYSIS_PARSE_BUDGET',`${results.length} interpretations exceed the configured maximum ${maxResults}.`)]};
 return {analyses:results.map((result,index)=>({valueType:'SyntacticAnalysis',id:`${input.id}:composed:${index}`,rootId:result.root,nodes:{[result.root]:{template:{root:result.root,objects:result.objects},captures:result.captures,patternId:result.id}}})),diagnostics:[]};
}
