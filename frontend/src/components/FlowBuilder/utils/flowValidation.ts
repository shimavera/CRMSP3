import type { FlowData } from '../../../lib/supabase';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFlow(flowData: FlowData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { nodes, edges } = flowData;

  if (!nodes || nodes.length === 0) {
    errors.push('O fluxo precisa de pelo menos um nó');
    return { isValid: false, errors, warnings };
  }

  // 1. Exactly one trigger node
  const triggerNodes = nodes.filter(n => n.type === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push('O fluxo precisa de um nó de Gatilho');
  } else if (triggerNodes.length > 1) {
    errors.push('Apenas um nó de Gatilho é permitido');
  }

  // 2. At least one end node
  const endNodes = nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    warnings.push('Recomendado adicionar pelo menos um nó de Fim');
  }

  // 3. Connectivity check (BFS from trigger)
  if (triggerNodes.length === 1) {
    const reachable = bfsFromNode(triggerNodes[0].id, edges);
    const unreachable = nodes.filter(n => !reachable.has(n.id));
    if (unreachable.length > 0) {
      errors.push(`${unreachable.length} nó(s) não conectado(s) ao fluxo principal`);
    }
  }

  // 4. Condition nodes must have exactly 2 outgoing edges (true/false)
  for (const node of nodes.filter(n => n.type === 'condition')) {
    const outEdges = edges.filter(e => e.source === node.id);
    const trueEdge = outEdges.find(e => e.sourceHandle === 'true');
    const falseEdge = outEdges.find(e => e.sourceHandle === 'false');
    if (!trueEdge) {
      errors.push(`Condição "${(node.data as { label?: string }).label}" sem caminho "Sim" conectado`);
    }
    if (!falseEdge) {
      errors.push(`Condição "${(node.data as { label?: string }).label}" sem caminho "Não" conectado`);
    }
  }

  // 5. Send message nodes must have at least 1 message
  for (const node of nodes.filter(n => n.type === 'send_message')) {
    const data = node.data as { messages?: unknown[] };
    if (!data.messages || data.messages.length === 0) {
      errors.push(`Nó "${(node.data as { label?: string }).label}" precisa de pelo menos uma mensagem`);
    }
  }

  // 6. Wait delay nodes must have positive value
  for (const node of nodes.filter(n => n.type === 'wait_delay')) {
    const data = node.data as { delay_value?: number };
    if (!data.delay_value || data.delay_value <= 0) {
      errors.push(`Nó "${(node.data as { label?: string }).label}" precisa de um tempo de espera maior que 0`);
    }
  }

  // 7. Non-condition, non-end, non-trigger nodes should have outgoing edge
  for (const node of nodes.filter(n => n.type !== 'end' && n.type !== 'condition' && n.type !== 'trigger')) {
    const outEdges = edges.filter(e => e.source === node.id);
    if (outEdges.length === 0) {
      warnings.push(`Nó "${(node.data as { label?: string }).label || node.type}" não tem conexão de saída`);
    }
  }

  // 8. Check for cycles without wait node (could cause infinite loops)
  if (triggerNodes.length === 1) {
    const cycleWithoutWait = detectCycleWithoutWait(nodes, edges);
    if (cycleWithoutWait) {
      errors.push('Ciclo detectado sem nó de Aguardar — isso causaria um loop infinito');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function bfsFromNode(startId: string, edges: FlowData['edges']): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return visited;
}

function detectCycleWithoutWait(nodes: FlowData['nodes'], edges: FlowData['edges']): boolean {
  const waitNodeIds = new Set(nodes.filter(n => n.type === 'wait_delay').map(n => n.id));
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  // DFS to detect cycles skipping wait nodes (they break the cycle)
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node.id, WHITE);

  function dfs(nodeId: string): boolean {
    // Wait nodes break cycles
    if (waitNodeIds.has(nodeId)) {
      color.set(nodeId, BLACK);
      return false;
    }

    color.set(nodeId, GRAY);
    for (const neighbor of adjacency.get(nodeId) || []) {
      if (color.get(neighbor) === GRAY) return true; // back edge = cycle
      if (color.get(neighbor) === WHITE && dfs(neighbor)) return true;
    }
    color.set(nodeId, BLACK);
    return false;
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE && dfs(node.id)) return true;
  }

  return false;
}
