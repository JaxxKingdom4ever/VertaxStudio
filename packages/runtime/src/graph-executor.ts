import { compilerValueType, type CompilerValue, type Diagnostic } from "../../core-types/src/index.js";
import { type GraphDefinition, type NodeContext, NodeRegistry } from "./node-registry.js";

export interface GraphExecutionResult {
  readonly outputs: Readonly<Record<string, readonly CompilerValue[]>>;
  readonly diagnostics: readonly Diagnostic[];
  readonly state: NodeContext["state"];
  readonly nodeIds: readonly string[];
}

const isError = (d: Diagnostic): boolean => d.severity === "Error" || d.severity === "Fatal";

export function executeGraph(
  graph: GraphDefinition,
  registry: NodeRegistry,
  ctx: NodeContext,
  inputs: Readonly<Record<string, readonly CompilerValue[]>>
): GraphExecutionResult {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const nodeInputs = new Map<string, Record<string, CompilerValue[]>>();
  const nodeOutputs = new Map<string, Readonly<Record<string, readonly CompilerValue[]>>>();
  const terminal = new Set<string>();
  const executed: string[] = [];
  let state = ctx.state;
  for (const n of graph.nodes) nodeInputs.set(n.id, {});

  const accept = (nodeId: string, portId: string, vals: readonly CompilerValue[]) => {
    const node = nodes.get(nodeId);
    const def = node && registry.get(node.typeId);
    const port = def?.inputs.find(p => p.id === portId);
    if (!def || !port) {
      diagnostics.push({severity:"Error",code:"UNKNOWN_PORT",message:`Unknown input ${nodeId}.${portId}`});
      return;
    }
    let valid = true;
    for (const v of vals) {
      if (!port.acceptedTypes.includes(compilerValueType(v))) {
        diagnostics.push({severity:"Error",code:"PORT_TYPE_MISMATCH",message:`${nodeId}.${portId} rejects ${compilerValueType(v)}`,nodeId});
        valid = false;
      }
    }
    const existing = nodeInputs.get(nodeId)![portId] ?? [];
    if (port.cardinality !== "MANY" && existing.length + vals.length > 1) {
      diagnostics.push({severity:"Error",code:"PORT_CARDINALITY_MISMATCH",message:`${nodeId}.${portId} accepts at most one value.`,nodeId});
      valid = false;
    }
    if (valid) nodeInputs.get(nodeId)![portId] = port.cardinality === "MANY" ? [...existing, ...vals] : [...vals];
  };

  for (const b of graph.exposedInputs) {
    const values = inputs[b.graphPortId] ?? [];
    const node = nodes.get(b.nodeId);
    const port = node && registry.get(node.typeId)?.inputs.find(p => p.id === b.nodePortId);
    if (port?.required && values.length === 0) {
      diagnostics.push({severity:"Error",code:"MISSING_REQUIRED_GRAPH_INPUT",message:`Graph input ${b.graphPortId} is required by ${b.nodeId}.${b.nodePortId}.`,nodeId:b.nodeId});
    }
    accept(b.nodeId, b.nodePortId, values);
  }

  while (terminal.size < graph.nodes.length && !diagnostics.some(isError)) {
    // A graph node may run only after *every* incoming producer has settled;
    // this preserves variadic port completeness and removes node-ID-order races.
    const settled = graph.nodes.filter(n => !terminal.has(n.id)).filter(n =>
      graph.edges.filter(e => e.targetNodeId === n.id).every(e => terminal.has(e.sourceNodeId))
    ).sort((a,b) => a.id.localeCompare(b.id));
    if (!settled.length) {
      diagnostics.push({severity:"Error",code:"CYCLIC_GRAPH_EDGE",message:"Graph has an unresolved dependency cycle."});
      break;
    }
    const n = settled[0]!;
    const def = registry.get(n.typeId);
    if (!def) {
      diagnostics.push({severity:"Error",code:"UNKNOWN_NODE_TYPE",message:`Unknown node type ${n.typeId}`,nodeId:n.id});
      break;
    }
    const inValues = nodeInputs.get(n.id)!;
    if (def.inputs.some(p => p.required && (inValues[p.id]?.length ?? 0) === 0)) {
      terminal.add(n.id); // Inactive branch: never confuse it with a cycle.
      continue;
    }
    const evaluation = def.evaluate({...ctx,state,nodeId:n.id,graphId:graph.id},inValues,n.params);
    diagnostics.push(...evaluation.diagnostics);
    state = evaluation.state ?? state;
    for (const port of def.outputs) {
      const vals = evaluation.outputs[port.id] ?? [];
      if (port.required && vals.length === 0) diagnostics.push({severity:"Error",code:"MISSING_NODE_OUTPUT",message:`${n.id}.${port.id} produced no required output.`,nodeId:n.id});
      if (port.cardinality !== "MANY" && vals.length > 1) diagnostics.push({severity:"Error",code:"NODE_OUTPUT_CARDINALITY_MISMATCH",message:`${n.id}.${port.id} produced more than one value.`,nodeId:n.id});
      for (const v of vals) if (!port.acceptedTypes.includes(compilerValueType(v))) diagnostics.push({severity:"Error",code:"NODE_OUTPUT_TYPE_MISMATCH",message:`${n.id}.${port.id} declared ${port.acceptedTypes.join(", ")} but produced ${compilerValueType(v)}.`,nodeId:n.id});
    }
    nodeOutputs.set(n.id,evaluation.outputs);
    terminal.add(n.id);
    executed.push(n.id);
    if (!diagnostics.some(d => isError(d) && d.nodeId === n.id)) {
      for (const edge of graph.edges.filter(e => e.sourceNodeId === n.id)) {
        accept(edge.targetNodeId, edge.targetPortId, evaluation.outputs[edge.sourcePortId] ?? []);
      }
    }
  }
  const outputs: Record<string, readonly CompilerValue[]> = {};
  for (const b of graph.exposedOutputs) outputs[b.graphPortId] = nodeOutputs.get(b.nodeId)?.[b.nodePortId] ?? [];
  return {outputs,diagnostics,state,nodeIds:executed};
}
