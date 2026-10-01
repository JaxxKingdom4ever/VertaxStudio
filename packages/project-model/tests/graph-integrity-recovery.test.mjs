import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,validateProject,toCompilerProject} from '../../../dist/packages/project-model/src/index.js';
const load=async()=>{const {project,diagnostics}=await loadProject('examples/reference-language.vertax');assert.ok(project,JSON.stringify(diagnostics));return project};
const broken=(p,graph)=>({...p,stageDocuments:p.stageDocuments.map(d=>d.stage==='Grammar'?{...d,graph}:d)});

test('project validator rejects dangling graph edge endpoint before compiler adaptation',async()=>{
 const p=await load(),g=p.stageDocuments.find(d=>d.stage==='Grammar').graph;
 const bad=broken(p,{...g,edges:[{sourceNodeId:'missing',sourcePortId:'value',targetNodeId:'realize-clause',targetPortId:'value'}]});
 assert.ok(validateProject(bad).some(d=>d.code==='MISSING_GRAPH_EDGE_NODE'));
 assert.equal(toCompilerProject(bad).project,undefined);
});

test('project validator rejects dangling exposed bindings and duplicate graph node IDs',async()=>{
 const p=await load(),g=p.stageDocuments.find(d=>d.stage==='Grammar').graph;
 assert.ok(validateProject(broken(p,{...g,exposedInputs:[{graphPortId:'value',nodeId:'gone',nodePortId:'value'}]})).some(d=>d.code==='MISSING_GRAPH_BINDING_NODE'));
 assert.ok(validateProject(broken(p,{...g,nodes:[...g.nodes,{...g.nodes[0]}]})).some(d=>d.code==='DUPLICATE_GRAPH_NODE_ID'));
});

test('project validator rejects calls to unknown persisted Node Groups, including inside group graphs',async()=>{
 const p=await load(),g=p.stageDocuments.find(d=>d.stage==='Grammar').graph;
 assert.ok(validateProject(broken(p,{...g,nodes:g.nodes.map(n=>({...n,typeId:'node-group:not-here'}))})).some(d=>d.code==='MISSING_NODE_GROUP_REFERENCE'));
 const group=p.nodeGroups['reference-clause'];
 const nested={...p,nodeGroups:{...p.nodeGroups,'reference-clause':{...group,internal_graph:{...group.internal_graph,nodes:group.internal_graph.nodes.map(n=>({...n,typeId:'node-group:ghost'}))}}}};
 assert.ok(validateProject(nested).some(d=>d.code==='MISSING_NODE_GROUP_REFERENCE'));
});

test('valid persisted reference-conlang graph passes integrity checks',async()=>{
 assert.deepEqual(validateProject(await load()).filter(d=>d.severity==='Error'||d.severity==='Fatal'),[]);
});
