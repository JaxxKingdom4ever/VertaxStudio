import test from 'node:test';
import assert from 'node:assert/strict';
import {renderNodeView} from '../../../dist/apps/studio/src/node-view.js';

class SvgElement {
  constructor(tag){this.tagName=tag;this.attributes={};this.dataset={};this.children=[];this.textContent='';this.classList={_class:"",add(name){this._class=name}}}
  setAttribute(name,value){this.attributes[name]=value}
  append(...elements){this.children.push(...elements)}
  addEventListener(){}
}

test('graph node keeps port type detail in socket tooltips instead of overlapping labels',()=>{
  const original=globalThis.document;
  globalThis.document={createElementNS:(_ns,tag)=>new SvgElement(tag)};
  try{
    const graphNode={id:'example-long-node',typeId:'node-group:extended-question-morphology',params:{}};
    const ports=[
      {nodeId:graphNode.id,portId:'incoming-semantic-context',direction:'input',acceptedTypes:['SemanticGraph','GrammarStructure'],cardinality:'ONE'},
      {nodeId:graphNode.id,portId:'realized-output-sequence',direction:'output',acceptedTypes:['MorphSequence','PhonologicalForm'],cardinality:'ONE'}
    ];
    const el=renderNodeView(graphNode,{x:0,y:0,width:210,height:92},false,ports);
    const labels=el.children.filter(child=>child.classList._class==='port-label');
    assert.deepEqual(labels.map(label=>label.textContent),['incoming-sema…','realized-outp…']);
    const tooltips=el.children.filter(child=>child.classList._class==='port-socket').map(child=>child.children[0]?.textContent);
    assert.ok(tooltips[0].includes('SemanticGraph'));
    assert.ok(tooltips[1].includes('PhonologicalForm'));
  }finally{globalThis.document=original}
});
