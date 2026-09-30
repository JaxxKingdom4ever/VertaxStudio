import type { StudioState, PortEndpoint } from '../../../packages/studio-model/src/index.js';
import type { ViewportLayout } from '../../../packages/project-model/src/index.js';
import {
  activeGraphDefinition, checkPortConnection, connectPorts, disconnectEdge, ensureNodeLayout,
  enterNodeGroup, graphEdgeKey, moveNode, parseNodeGroupTypeId, resolveNodePorts,
  selectEdge, selectNode, setViewport, selectedGraphLayout
} from '../../../packages/studio-model/src/index.js';
import { renderNodeView, SVG_NS } from './node-view.js';

export function panViewport(viewport:ViewportLayout,dx:number,dy:number):ViewportLayout {
  return {x:viewport.x+dx,y:viewport.y+dy,zoom:viewport.zoom};
}
/** Calculate from the initial pointer position: intermediate events must never accumulate drift. */
export function draggedNodePosition(start:{x:number;y:number},dx:number,dy:number,zoom:number):{x:number;y:number} {
  return {x:start.x+dx/zoom,y:start.y+dy/zoom};
}
/** One completed pointer gesture is one undoable edit, regardless of event frequency. */
export function finishNodeDrag(state:StudioState,nodeId:string,position:{x:number;y:number}):StudioState {
  return selectNode(moveNode(state,nodeId,position.x,position.y),nodeId);
}

export function renderGraphCanvas(container:HTMLElement,state:StudioState,onChange:(state:StudioState)=>void,onDiagnostics?:(messages:readonly string[])=>void):void {
  container.replaceChildren();
  const active=activeGraphDefinition(state);
  if(!active){container.textContent='No graph selected';return;}
  const nested=(state.graphSelection?.nodeGroupPath.length??0)>0;
  let working=state;
  if(!nested)for(const node of active.nodes)working=ensureNodeLayout(working,node.id);
  const persisted=selectedGraphLayout(working);
  const virtualNodes=Object.fromEntries(active.nodes.map((node,index)=>[
    node.id,persisted?.nodes[node.id]??{x:(index%4)*240,y:Math.floor(index/4)*150}
  ]));
  const layout=nested?{schema_version:1 as const,graph_id:active.id,nodes:virtualNodes}:
    {...(persisted??{schema_version:1 as const,graph_id:active.id,nodes:{}}),nodes:virtualNodes};
  if(working!==state)onChange(working);

  const svg=document.createElementNS(SVG_NS,'svg');
  svg.classList.add('graph-svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');
  container.append(svg);
  const viewport=document.createElementNS(SVG_NS,'g');
  const view=layout.viewport??{x:0,y:0,zoom:1};
  viewport.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.zoom})`);
  svg.append(viewport);
  let pending:PortEndpoint|undefined;
  const edges=new Map<string,SVGLineElement>();

  for(const edge of active.edges){
    const a=layout.nodes[edge.sourceNodeId],b=layout.nodes[edge.targetNodeId];
    if(!a||!b)continue;
    const line=document.createElementNS(SVG_NS,'line');
    line.setAttribute('x1',String(a.x+(layout.nodes[edge.sourceNodeId]?.width??210)));line.setAttribute('y1',String(a.y+62));
    line.setAttribute('x2',String(b.x));line.setAttribute('y2',String(b.y+62));
    line.classList.add('graph-edge');const key=graphEdgeKey(edge);line.dataset.edgeKey=key;
    if(state.selection.kind==='edge'&&state.selection.id===key)line.classList.add('selected');
    line.addEventListener('click',event=>{event.stopPropagation();onChange(selectEdge(working,key))});
    edges.set(key,line);viewport.append(line);
  }
  const previewNode=(nodeId:string,position:{x:number;y:number},element:SVGGElement)=>{
    element.setAttribute('transform',`translate(${position.x} ${position.y})`);
    for(const edge of active.edges){
      if(edge.sourceNodeId!==nodeId&&edge.targetNodeId!==nodeId)continue;
      const a=edge.sourceNodeId===nodeId?position:layout.nodes[edge.sourceNodeId];
      const b=edge.targetNodeId===nodeId?position:layout.nodes[edge.targetNodeId];
      const line=edges.get(graphEdgeKey(edge));if(!a||!b||!line)continue;
      line.setAttribute('x1',String(a.x+(layout.nodes[edge.sourceNodeId]?.width??210)));line.setAttribute('y1',String(a.y+62));
      line.setAttribute('x2',String(b.x));line.setAttribute('y2',String(b.y+62));
    }
  };

  for(const node of active.nodes){
    const pos=layout.nodes[node.id]??{x:0,y:0};
    const el=renderNodeView(node,pos,state.selection.kind==='node'&&state.selection.id===node.id,resolveNodePorts(working,node.id),{
      onPortDown:(port,event)=>{
        if(port.direction==='output'){event.stopPropagation();pending={nodeId:port.nodeId,portId:port.portId}}
      },
      onPortUp:(port,event)=>{
        if(!pending||port.direction!=='input')return;
        event.stopPropagation();const target={nodeId:port.nodeId,portId:port.portId};
        const result=connectPorts(working,pending,target);pending=undefined;
        if(result.diagnostics.length)onDiagnostics?.(result.diagnostics.map(d=>d.message));
        else onChange(result.state);
      },
      onPortEnter:(port,socket)=>{
        if(!pending||port.direction!=='input')return;
        const diagnostics=checkPortConnection(working,pending,{nodeId:port.nodeId,portId:port.portId});
        socket.classList.toggle('connection-refused',diagnostics.length>0);
        socket.classList.toggle('connection-allowed',diagnostics.length===0);
      },
      onPortLeave:(_port,socket)=>socket.classList.remove('connection-refused','connection-allowed')
    });
    el.addEventListener('dblclick',event=>{
      const groupId=parseNodeGroupTypeId(node.typeId);
      if(groupId){event.stopPropagation();onChange(enterNodeGroup(working,groupId))}
    });
    el.addEventListener('pointerdown',event=>{
      if(event.button!==0||(event.target as Element).classList.contains('port-socket'))return;
      event.stopPropagation();
      // Committing selection on pointerdown rerenders/removes this element,
      // taking its pointer-capture and drag listeners with it. Preview first,
      // then commit once on pointerup using listeners on the stable window.
      const pointer=event.pointerId,startX=event.clientX,startY=event.clientY;
      let moved=false, next=pos;
      el.classList.add('selected');
      const onMove=(e:PointerEvent)=>{
        if(e.pointerId!==pointer||nested)return;
        moved=moved||Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY)>3;
        if(!moved)return;
        next=draggedNodePosition(pos,e.clientX-startX,e.clientY-startY,view.zoom);
        previewNode(node.id,next,el);
      };
      const cleanup=()=>{
        window.removeEventListener('pointermove',onMove);
        window.removeEventListener('pointerup',onUp);
        window.removeEventListener('pointercancel',onCancel);
      };
      const onUp=(e:PointerEvent)=>{
        if(e.pointerId!==pointer)return;
        cleanup();onChange(moved&&!nested?finishNodeDrag(working,node.id,next):selectNode(working,node.id));
      };
      const onCancel=(e:PointerEvent)=>{
        if(e.pointerId!==pointer)return;
        cleanup();previewNode(node.id,pos,el);onChange(selectNode(working,node.id));
      };
      window.addEventListener('pointermove',onMove);
      window.addEventListener('pointerup',onUp);
      window.addEventListener('pointercancel',onCancel);
    });
    viewport.append(el);
  }

  svg.addEventListener('pointerdown',event=>{
    if(event.target!==svg||event.button!==0)return;
    const pointer=event.pointerId,startX=event.clientX,startY=event.clientY;
    let next=view;
    const onMove=(e:PointerEvent)=>{
      if(e.pointerId!==pointer)return;
      next=panViewport(view,e.clientX-startX,e.clientY-startY);
      viewport.setAttribute('transform',`translate(${next.x} ${next.y}) scale(${next.zoom})`);
    };
    const cleanup=()=>{
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onCancel);
    };
    const onUp=(e:PointerEvent)=>{
      if(e.pointerId!==pointer)return;
      cleanup();
      if(next.x!==view.x||next.y!==view.y)onChange(setViewport(working,next));
      else onChange({...working,selection:{kind:'none'}});
    };
    const onCancel=(e:PointerEvent)=>{
      if(e.pointerId!==pointer)return;
      cleanup();viewport.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.zoom})`);
    };
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    window.addEventListener('pointercancel',onCancel);
  });
  svg.addEventListener('wheel',event=>{
    event.preventDefault();const zoom=Math.max(.35,Math.min(2.5,view.zoom*(event.deltaY>0?.9:1.1)));
    onChange(setViewport(working,{...view,zoom}));
  },{passive:false});
  container.onkeydown=event=>{
    if((event.key==='Delete'||event.key==='Backspace')&&state.selection.kind==='edge'&&state.selection.id){
      const result=disconnectEdge(working,state.selection.id);
      if(result.diagnostics.length)onDiagnostics?.(result.diagnostics.map(d=>d.message));
      else onChange({...result.state,selection:{kind:'none'}});
    }
  };
}
