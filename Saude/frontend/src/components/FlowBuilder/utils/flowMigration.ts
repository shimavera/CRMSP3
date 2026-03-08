import type { FollowupStep } from '../../../lib/supabase';
import type { FlowData, FlowNode, FlowEdge, FlowMessageItem } from '../../../lib/supabase';

/**
 * Converte etapas lineares de follow-up (sistema antigo) para um grafo visual (sistema novo).
 *
 * Estrutura gerada:
 *   Gatilho (manual)
 *     → Enviar Msg 1 → Aguardar → Condição (respondeu?)
 *       → Sim: Fim (Converteu)
 *       → Não: Enviar Msg 2 → Aguardar → Condição → ...
 *     → Último Não: Fim (Frio)
 */
export function migrateLinearStepsToFlow(steps: FollowupStep[]): FlowData {
  const sortedSteps = [...steps]
    .filter(s => s.active)
    .sort((a, b) => a.step_number - b.step_number);

  if (sortedSteps.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const X_CENTER = 300;
  const Y_STEP = 120;
  const X_BRANCH = 600;
  let y = 50;

  // 1. Gatilho
  const triggerId = crypto.randomUUID();
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: X_CENTER, y },
    data: { label: 'Gatilho', triggerType: 'manual', config: {} },
  });
  y += Y_STEP;

  // 2. Fim (Converteu) — posicionado ao lado para branches "Sim"
  const endSuccessId = crypto.randomUUID();
  nodes.push({
    id: endSuccessId,
    type: 'end',
    position: { x: X_BRANCH, y: 50 + Y_STEP * 2 },
    data: { label: 'Converteu', outcome: 'success' },
  });

  // 3. Fim (Frio) — será posicionado ao final
  const endColdId = crypto.randomUUID();

  let prevNodeId = triggerId;

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const isLast = i === sortedSteps.length - 1;

    // Nó: Enviar Mensagem
    const sendMsgId = crypto.randomUUID();
    const messages: FlowMessageItem[] = (step.messages || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(m => ({
        message_type: m.message_type,
        text_content: m.text_content,
        media_url: m.media_url,
        media_name: m.media_name,
        media_mime: m.media_mime,
        caption: m.caption,
      }));

    nodes.push({
      id: sendMsgId,
      type: 'send_message',
      position: { x: X_CENTER, y },
      data: { label: `${step.step_number}º Follow-up`, messages },
    });

    edges.push({
      id: crypto.randomUUID(),
      source: prevNodeId,
      target: sendMsgId,
    });
    y += Y_STEP;

    // Nó: Aguardar
    const waitId = crypto.randomUUID();
    nodes.push({
      id: waitId,
      type: 'wait_delay',
      position: { x: X_CENTER, y },
      data: {
        label: `Aguardar ${step.delay_days} ${step.delay_unit === 'minutes' ? 'min' : step.delay_unit === 'hours' ? 'h' : 'dia(s)'}`,
        delay_value: step.delay_days,
        delay_unit: step.delay_unit,
      },
    });

    edges.push({
      id: crypto.randomUUID(),
      source: sendMsgId,
      target: waitId,
    });
    y += Y_STEP;

    // Nó: Condição (respondeu?)
    const condId = crypto.randomUUID();
    nodes.push({
      id: condId,
      type: 'condition',
      position: { x: X_CENTER, y },
      data: {
        label: 'Respondeu?',
        condition_type: 'lead_responded',
        config: {},
      },
    });

    edges.push({
      id: crypto.randomUUID(),
      source: waitId,
      target: condId,
    });

    // Edge "Sim" → Fim (Converteu)
    edges.push({
      id: crypto.randomUUID(),
      source: condId,
      target: endSuccessId,
      sourceHandle: 'true',
      label: 'Sim',
    });

    if (isLast) {
      // Última condição "Não" → Fim (Frio)
      nodes.push({
        id: endColdId,
        type: 'end',
        position: { x: X_CENTER, y: y + Y_STEP },
        data: { label: 'Frio', outcome: 'failed' },
      });

      edges.push({
        id: crypto.randomUUID(),
        source: condId,
        target: endColdId,
        sourceHandle: 'false',
        label: 'Não',
      });
    }

    y += Y_STEP;
    prevNodeId = condId; // "Não" vai continuar para o próximo step

    // Se não for o último, conectar "Não" ao próximo SendMessage (que será criado no próximo loop)
    if (!isLast) {
      // A edge "Não" será a source para o próximo nó — prevNodeId fica com sourceHandle
      // Na verdade, precisamos criar a edge explicitamente no próximo loop
    }
  }

  // Corrigir edges "Não" intermediárias (que conectam ao próximo SendMessage)
  // Percorrer novamente para adicionar as edges faltantes
  const conditionNodes = nodes.filter(n => n.type === 'condition');
  const sendMessageNodes = nodes.filter(n => n.type === 'send_message');

  for (let i = 0; i < conditionNodes.length - 1; i++) {
    // Se não for o último condition, conectar "Não" ao próximo SendMessage
    const condNode = conditionNodes[i];
    const nextSendMsg = sendMessageNodes[i + 1];

    // Verificar se já existe uma edge "false" para este condition
    const existingFalseEdge = edges.find(e => e.source === condNode.id && e.sourceHandle === 'false');
    if (!existingFalseEdge && nextSendMsg) {
      edges.push({
        id: crypto.randomUUID(),
        source: condNode.id,
        target: nextSendMsg.id,
        sourceHandle: 'false',
        label: 'Não',
      });
    }
  }

  // Atualizar posição Y do Fim (Converteu) para ficar centralizado
  const endSuccessNode = nodes.find(n => n.id === endSuccessId);
  if (endSuccessNode) {
    endSuccessNode.position.y = Math.floor(y / 2);
  }

  return { nodes, edges };
}
