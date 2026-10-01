import type { Diagnostic, StableId } from "../../core-types/src/index.js";
import { executeGraph, type NodeRegistry } from "../../runtime/src/index.js";
import type { NodeGroupDocument } from "./node-groups.js";

export interface NodeGroupRuntimeOptions { readonly maxDepth?: number; }

export function nodeGroupTypeId(groupId: StableId): string { return `node-group:${groupId}`; }

function fail(code: string, message: string, objectId: string): Diagnostic {
  return { severity: "Error", code, message, objectId };
}

function substitute(value: unknown, bindings: Readonly<Record<string, unknown>>): unknown {
  if (Array.isArray(value)) return value.map(v => substitute(v, bindings));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length === 1 && typeof record.$groupParam === "string") {
      return bindings[record.$groupParam];
    }
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, substitute(v, bindings)]));
  }
  return value;
}

function parameterType(value: unknown): string {
  if (Array.isArray(value) || value === null) return "json";
  return typeof value;
}

export function registerPersistedNodeGroups(
  registry: NodeRegistry,
  groups: Readonly<Record<StableId, NodeGroupDocument>>,
  options: NodeGroupRuntimeOptions = {}
): void {
  const maxDepth = Math.max(1, options.maxDepth ?? 32);
  for (const group of Object.values(groups)) {
    registry.register({
      typeId: nodeGroupTypeId(group.id),
      inputs: group.inputs,
      outputs: group.outputs,
      evaluate(ctx, inputs, params) {
        const stack = ctx.nodeGroupStack ?? [];
        if (stack.length >= maxDepth || stack.includes(group.id)) {
          return { outputs: {}, diagnostics: [fail("NODE_GROUP_RECURSION_LIMIT", `Node Group ${group.id} cannot recursively call itself (stack: ${[...stack, group.id].join(" → ")}).`, group.id)] };
        }
        const bindings: Record<string, unknown> = {};
        const diagnostics: Diagnostic[] = [];
        for (const parameter of group.parameters) {
          const chosen = params[parameter.id] ?? parameter.defaultValue;
          if (chosen === undefined) {
            if (parameter.required) diagnostics.push(fail("MISSING_NODE_GROUP_PARAMETER", `Node Group ${group.id} requires parameter ${parameter.id}.`, group.id));
            continue;
          }
          if (parameter.valueType !== "json" && parameterType(chosen) !== parameter.valueType) {
            diagnostics.push(fail("INVALID_NODE_GROUP_PARAMETER", `Parameter ${parameter.id} must be ${parameter.valueType}.`, group.id));
            continue;
          }
          bindings[parameter.id] = chosen;
        }
        if (diagnostics.length) return {outputs:{}, diagnostics};
        const internal = {
          ...group.internal_graph,
          nodes: group.internal_graph.nodes.map(n => ({
            ...n,
            params: substitute(n.params, bindings) as Readonly<Record<string, unknown>>
          }))
        };
        const result = executeGraph(internal, registry, {
          ...ctx,
          nodeGroupStack: [...stack, group.id],
          nodeGroupParams: bindings
        }, inputs);
        return { outputs: result.outputs, diagnostics: result.diagnostics, state: result.state };
      }
    });
  }
}
