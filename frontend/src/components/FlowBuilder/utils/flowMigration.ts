import type { FollowupStep } from '../../../lib/supabase';
import type { FlowData, FlowNode, FlowEdge, FlowMessageItem } from '../../../lib/supabase';

export interface MigrationOptions {
  triggerType?: 'manual' | 'no_response_timeout';
  timeoutConfig?: { timeout_value: string; timeout_unit: string };
  addLockAction?: boolean;
  businessHours?: boolean;
}

/**
 * Converte etapas lineares de follow-up (sistema antigo) para um grafo visual (sistema novo).
 *
 * Estrutura gerada:
 *   Gatilho (manual ou no_response_timeout)
 *     -> Enviar Msg 1 -> Aguardar -> Condicao (respondeu?)
 *       -> Sim: Fim (Converteu)
 *       -> Nao: Enviar Msg 2 -> Aguardar -> Condicao -> ...
 *     -> Ultimo Nao: [Action: lock_followup] -> Fim (Frio)
 */
export function migrateLinearStepsToFlow(
  steps: FollowupStep[],
  options: MigrationOptions = {}
): FlowData {
  const {
    triggerType = 'no_response_timeout',
    timeoutConfig = { timeout_value: '30', timeout_unit: 'minutes' },
    addLockAction = true,
    businessHours = true,
  } = options;

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
    data: {
      label: triggerType === 'no_response_timeout' ? 'Sem Resposta' : 'Gatilho',
      triggerType,
      config: triggerType === 'no_response_timeout' ? { ...timeoutConfig } : {},
    },
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

  // 3. Fim (Frio) — sera posicionado ao final
  const endColdId = crypto.randomUUID();

  let prevNodeId = triggerId;

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const isLast = i === sortedSteps.length - 1;

    // No: Enviar Mensagem
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
      data: { label: `${step.step_number}o Follow-up`, messages },
    });

    edges.push({
      id: crypto.randomUUID(),
      source: prevNodeId,
      target: sendMsgId,
    });
    y += Y_STEP;

    // No: Aguardar (com business_hours se habilitado)
    const waitId = crypto.randomUUID();
    nodes.push({
      id: waitId,
      type: 'wait_delay',
      position: { x: X_CENTER, y },
      data: {
        label: `Aguardar ${step.delay_days} ${step.delay_unit === 'minutes' ? 'min' : step.delay_unit === 'hours' ? 'h' : 'dia(s)'}`,
        delay_value: step.delay_days,
        delay_unit: step.delay_unit,
        ...(businessHours ? { business_hours: true } : {}),
      },
    });

    edges.push({
      id: crypto.randomUUID(),
      source: sendMsgId,
      target: waitId,
    });
    y += Y_STEP;

    // No: Condicao (respondeu?)
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

    // Edge "Sim" -> Fim (Converteu)
    edges.push({
      id: crypto.randomUUID(),
      source: condId,
      target: endSuccessId,
      sourceHandle: 'true',
      label: 'Sim',
    });

    if (isLast) {
      if (addLockAction) {
        // Ultimo "Nao" -> Action(lock_followup) -> Fim(Frio)
        const actionLockId = crypto.randomUUID();
        nodes.push({
          id: actionLockId,
          type: 'action',
          position: { x: X_CENTER, y: y + Y_STEP },
          data: { label: 'Desativar IA', action_type: 'lock_followup', config: {} },
        });

        edges.push({
          id: crypto.randomUUID(),
          source: condId,
          target: actionLockId,
          sourceHandle: 'false',
          label: 'Nao',
        });

        nodes.push({
          id: endColdId,
          type: 'end',
          position: { x: X_CENTER, y: y + Y_STEP * 2 },
          data: { label: 'Frio', outcome: 'failed' },
        });

        edges.push({
          id: crypto.randomUUID(),
          source: actionLockId,
          target: endColdId,
        });
      } else {
        // Sem lock: "Nao" -> Fim (Frio) diretamente
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
          label: 'Nao',
        });
      }
    }

    y += Y_STEP;
    prevNodeId = condId;
  }

  // Corrigir edges "Nao" intermediarias
  const conditionNodes = nodes.filter(n => n.type === 'condition');
  const sendMessageNodes = nodes.filter(n => n.type === 'send_message');

  for (let i = 0; i < conditionNodes.length - 1; i++) {
    const condNode = conditionNodes[i];
    const nextSendMsg = sendMessageNodes[i + 1];

    const existingFalseEdge = edges.find(e => e.source === condNode.id && e.sourceHandle === 'false');
    if (!existingFalseEdge && nextSendMsg) {
      edges.push({
        id: crypto.randomUUID(),
        source: condNode.id,
        target: nextSendMsg.id,
        sourceHandle: 'false',
        label: 'Nao',
      });
    }
  }

  // Atualizar posicao Y do Fim (Converteu) para ficar centralizado
  const endSuccessNode = nodes.find(n => n.id === endSuccessId);
  if (endSuccessNode) {
    endSuccessNode.position.y = Math.floor(y / 2);
  }

  return { nodes, edges };
}
