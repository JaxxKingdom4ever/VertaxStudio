import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeRegistry} from '../../../dist/packages/runtime/src/index.js';
import {registerCorePrimitives} from '../../../dist/packages/primitives/src/index.js';
import {
 createStudioState,selectGraph,buildNodeCatalog,searchNodeCatalog,addCatalogNode,
 updateNodeParams,connectPorts,activeGraphDefinition,createStudioHistory,
 applyStudioEdit,undoStudio,redoStudio,selectNode,selectedInspectorModel
} from '../../../dist/packages/studio-model/src/index.js';
import {referencePersistedProject} from '../../../dist/examples/reference-slice/persisted-project.js';
import {referenceStudioState} from '../../../dist/examples/reference-slice/studio-project.js';
import {parseTypedParameter} from '../../../dist/apps/studio/src/typed-parameter.js';
import {exportBrowserProject,importBrowserProject} from '../../../dist/apps/studio/src/browser-project.js';

const registry=new NodeRegistry();registerCorePrimitives(registry);
test('Studio morphology workflow: navigate → shelf → params → connect → export/import → undo/redo',()=>{
 const morphology=referencePersistedProject.stageDocuments.find(x=>x.stage==='Morphology');
 assert.ok(morphology);
 const starting=referenceStudioState;
 const chosen=selectGraph(starting,'Morphology',morphology.graph.id);
 const catalog=buildNodeCatalog(chosen);
 const select=searchNodeCatalog(catalog,'allomorph')[0];
 assert.equal(select.typeId,'morph.select-allomorph');
 let history=createStudioHistory(chosen);
 history=applyStudioEdit(history,state=>addCatalogNode(state,select,{x:360,y:210}));
 const nodeId=history.present.selection.id;
 assert.ok(nodeId);
 const descriptor=registry.get(select.typeId).authoring.parameters.find(x=>x.id==='candidates');
 const candidates=parseTypedParameter(descriptor,'[{"form":"cooked","when":{"tense":"past"}},{"form":"cook","fallback":true}]');
 history=applyStudioEdit(history,state=>updateNodeParams(state,nodeId,{candidates}));
 const source=activeGraphDefinition(history.present).nodes.find(x=>x.typeId==='ref.to-morph');
 assert.ok(source);
 history=applyStudioEdit(history,state=>connectPorts(state,{nodeId:source.id,portId:'value'},{nodeId,portId:'value'}));
 assert.equal(activeGraphDefinition(history.present).edges.some(x=>x.targetNodeId===nodeId),true);
 const inspected=selectedInspectorModel(selectNode(history.present,nodeId));
 assert.deepEqual(inspected.params.candidates,candidates);
 const exported=exportBrowserProject(history.present);
 const imported=importBrowserProject(exported,registry.listDefinitions());
 assert.deepEqual(imported.diagnostics,[]);
 assert.ok(imported.state.project.stageDocuments.find(x=>x.stage==='Morphology').graph.nodes.some(x=>x.id===nodeId));
 assert.equal(activeGraphDefinition(undoStudio(history).present).edges.some(x=>x.targetNodeId===nodeId),false);
 assert.equal(activeGraphDefinition(redoStudio(undoStudio(history)).present).edges.some(x=>x.targetNodeId===nodeId),true);
});
