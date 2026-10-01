import { NodeRegistry } from '../../packages/runtime/src/index.js';
import { registerCorePrimitives } from '../../packages/primitives/src/index.js';
import { createStudioState } from '../../packages/studio-model/src/index.js';
import { referencePersistedProject } from './persisted-project.js';
import { registerReferenceSliceNodes } from './project.js';
const registry=new NodeRegistry();registerCorePrimitives(registry);registerReferenceSliceNodes(registry);
export const referenceStudioState=createStudioState(referencePersistedProject,registry.listDefinitions());
