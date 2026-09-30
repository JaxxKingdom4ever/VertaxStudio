import test from 'node:test';
import assert from 'node:assert/strict';
import {renderGraphCanvas} from '../../../dist/apps/studio/src/graph-canvas.js';
import {createStudioState,selectedGraphDocument,selectedGraphLayout} from '../../../dist/packages/studio-model/src/index.js';
import {referencePersistedProject} from '../../../dist/examples/reference-slice/persisted-project.js';

class FakeElement {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners=new Map();this.attributes={};this.dataset={};this.textContent='';this.classList={classes:new Set(),add:(...names)=>names.forEach(x=>this.classList.classes.add(x)),contains:name=>this.classList.classes.has(name),toggle:(name,value)=>value?this.classList.classes.add(name):this.classList.classes.delete(name)};}
 append(...nodes){this.children.push(...nodes);return this}
 replaceChildren(...nodes){this.children=[...nodes]}
 setAttribute(name,value){this.attributes[name]=String(value)}
 setPointerCapture(_pointerId){}
 addEventListener(type,callback){const list=this.listeners.get(type)??[];list.push(callback);this.listeners.set(type,list)}
 removeEventListener(type,callback){this.listeners.set(type,(this.listeners.get(type)??[]).filter(x=>x!==callback))}
 dispatch(type,props={}){const event={type,target:this,button:0,pointerId:9,clientX:0,clientY:0,stopPropagation(){},preventDefault(){},...props};for(const callback of [...(this.listeners.get(type)??[])])callback(event);return event}
 descendants(){return [this,...this.children.flatMap(child=>child.descendants())]}
}

test('pointerdown and pointermove preview node and edges; pointerup alone commits one edit',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 const host=new FakeElement('host'),windowStub=new FakeElement('window');
 globalThis.document={createElementNS:(_ns,name)=>new FakeElement(name)};
 globalThis.window=windowStub;
 try{
  const state=createStudioState(referencePersistedProject);
  const graph=selectedGraphDocument(state).graph;
  const node=graph.nodes[0];
  const initial=selectedGraphLayout(state)?.nodes[node.id]??{x:0,y:0};
  const events=[];
  renderGraphCanvas(host,state,next=>events.push(next));
  const svg=host.descendants().find(x=>x.tagName==='svg');
  const element=host.descendants().find(x=>x.tagName==='g'&&x.dataset.nodeId===node.id);
  assert.ok(element);
  element.dispatch('pointerdown',{clientX:200,clientY:140,pointerId:8});
  windowStub.dispatch('pointermove',{clientX:260,clientY:182,pointerId:8});
  assert.equal(events.length,0,'pointer movement must not rerender and destroy the grabbed SVG element');
  assert.equal(element.attributes.transform,`translate(${initial.x+60} ${initial.y+42})`);
  windowStub.dispatch('pointerup',{clientX:260,clientY:182,pointerId:8});
  assert.equal(events.length,1);
  assert.equal(events[0].selection.id,node.id);
  assert.equal(selectedGraphLayout(events[0]).nodes[node.id].x,initial.x+60);
  assert.equal(windowStub.listeners.get('pointermove').length,0,'drag must not leak window listeners');
  assert.ok(svg);
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow}
});

test('panning commits once on release and does not discard the last viewport',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={createElementNS:(_ns,name)=>new FakeElement(name)};
 const windowStub=new FakeElement('window');globalThis.window=windowStub;
 try{
  const host=new FakeElement('host');const updates=[];
  const state=createStudioState(referencePersistedProject);
  renderGraphCanvas(host,state,next=>updates.push(next));
  const svg=host.descendants().find(x=>x.tagName==='svg');
  svg.dispatch('pointerdown',{clientX:10,clientY:15,pointerId:7});
  windowStub.dispatch('pointermove',{clientX:100,clientY:65,pointerId:7});
  assert.equal(updates.length,0);
  assert.match(svg.descendants().find(x=>x.tagName==='g').attributes.transform,/translate\(90 50\)/);
  windowStub.dispatch('pointerup',{clientX:100,clientY:65,pointerId:7});
  assert.equal(updates.length,1);
  assert.equal(selectedGraphLayout(updates[0]).viewport.x,90);
  assert.equal(selectedGraphLayout(updates[0]).viewport.y,50);
  assert.equal(windowStub.listeners.get('pointermove').length,0);
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow}
});
