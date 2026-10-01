import test from 'node:test';
import assert from 'node:assert/strict';
import {mountTranslationWorkspace} from '../../../dist/apps/studio/src/translation-workspace.js';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.textContent='';this.value='';this.disabled=false;}
 append(...items){for(const child of items){this.children.push(child);if(this.tagName==='select'&&this.children.length===1)this.value=child.value;}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(name,value){this.attributes[name]=value;}
 find(predicate){if(predicate(this))return this;for(const child of this.children){const found=child.find(predicate);if(found)return found;}return undefined;}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Studio Analyze only executes English source analysis without asking target generation to support the sentence',async()=>{
 const originalDocument=globalThis.document,originalFetch=globalThis.fetch;
 const calls=[];
 globalThis.document={createElement:tag=>new Element(tag)};
 globalThis.fetch=async(url,options)=>{
  if(url==='/api/language-packs')return {json:async()=>[{id:'english-pack',capabilities:['analyze','generate']},{id:'target-only',capabilities:['generate']}]};
  calls.push({url,body:JSON.parse(options.body)});
  return {status:200,json:async()=>({success:true,needsSelection:false,candidates:[{id:'m1',meaning:{roots:['e'],objects:{e:{conceptId:'sem:event.see',roles:{},features:{values:{}}}}}}],diagnostics:[]})};
 };
 try{
  const container=new Element('div');mountTranslationWorkspace(container,()=>{});await flush();
  const analyze=container.find(el=>el.tagName==='button'&&el.textContent==='Analyze only');
  assert.ok(analyze,'An independent analyze-only button should be visible');
  const textarea=container.find(el=>el.tagName==='textarea');textarea.value='The happy small girl saw the boy.';
  analyze.onclick();await flush();
  assert.deepEqual(calls,[{url:'/api/analyze',body:{sourcePack:'english-pack',text:'The happy small girl saw the boy.'}}]);
  assert.equal(container.find(el=>el.className==='translation-status').textContent,'Analysis completed.');
  assert.match(container.find(el=>el.className==='translation-meaning').textContent,/sem:event.see/);
 }finally{globalThis.document=originalDocument;globalThis.fetch=originalFetch;}
});
