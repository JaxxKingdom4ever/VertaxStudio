import type { CompilerValue, Diagnostic, StableId } from "../../core-types/src/index.js";
import type { RuntimeState } from "./state.js";

export interface PortDefinition {
  readonly id: string;
  readonly direction: "input" | "output";
  readonly acceptedTypes: readonly string[];
  readonly cardinality: "ONE" | "OPTIONAL" | "MANY";
  readonly required: boolean;
}

export interface NodeContext { readonly state: RuntimeState; readonly nodeId?: StableId; readonly graphId?: StableId; readonly resources?: unknown; readonly nodeGroupStack?: readonly StableId[]; readonly nodeGroupParams?: Readonly<Record<string, unknown>>; }
export interface NodeEvaluation {
  readonly outputs: Readonly<Record<string, readonly CompilerValue[]>>;
  readonly diagnostics: readonly Diagnostic[];
  readonly state?: RuntimeState;
  readonly reason?: string;
}
export interface NodeParameterDescriptor {
  readonly id: string;
  readonly label: string;
  readonly kind: 'text' | 'number' | 'boolean' | 'select' | 'table' | 'json';
  readonly options?: readonly string[];
}
export interface NodeAuthoring {
  readonly label: string;
  readonly category: string;
  readonly keywords?: readonly string[];
  readonly description?: string;
  readonly parameters?: readonly NodeParameterDescriptor[];
}
export interface NodeDefinition {
  readonly typeId: string;
  readonly authoring?: NodeAuthoring;
  readonly inputs: readonly PortDefinition[];
  readonly outputs: readonly PortDefinition[];
  evaluate(ctx: NodeContext, inputs: Readonly<Record<string, readonly CompilerValue[]>>, params: Readonly<Record<string, unknown>>): NodeEvaluation;
}

export class NodeRegistry {
  private readonly defs = new Map<string, NodeDefinition>();
  register(definition: NodeDefinition): void {
    if (this.defs.has(definition.typeId)) throw new Error(`Node type ${definition.typeId} already registered.`);
    this.defs.set(definition.typeId, definition);
  }
  setAuthoring(typeId:string,authoring:NodeAuthoring):void {
    const old=this.defs.get(typeId);
    if(!old)throw new Error(`Cannot author missing node type ${typeId}.`);
    this.defs.set(typeId,{...old,authoring});
  }
  get(typeId: string): NodeDefinition | undefined { return this.defs.get(typeId); }
  listDefinitions(): readonly NodeDefinition[] { return [...this.defs.values()]; }
}

export interface GraphNode { readonly id: StableId; readonly typeId: string; readonly params: Readonly<Record<string, unknown>>; }
export interface GraphEdge { readonly sourceNodeId: StableId; readonly sourcePortId: string; readonly targetNodeId: StableId; readonly targetPortId: string; }
export interface GraphPortBinding { readonly graphPortId: string; readonly nodeId: StableId; readonly nodePortId: string; }
export interface GraphDefinition {
  readonly id: StableId;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly exposedInputs: readonly GraphPortBinding[];
  readonly exposedOutputs: readonly GraphPortBinding[];
}
