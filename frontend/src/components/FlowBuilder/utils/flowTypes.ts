import type { Node, Edge } from '@xyflow/react';
import type {
  FlowNodeType,
  TriggerNodeData,
  SendMessageNodeData,
  WaitDelayNodeData,
  ConditionNodeData,
  ActionNodeData,
  EndNodeData,
  FlowMessageItem,
} from '../../../lib/supabase';

// Re-export para uso interno do FlowBuilder
export type {
  FlowNodeType,
  TriggerNodeData,
  SendMessageNodeData,
  WaitDelayNodeData,
  ConditionNodeData,
  ActionNodeData,
  EndNodeData,
  FlowMessageItem,
};

// React Flow node types mapeados
export type TriggerFlowNode = Node<TriggerNodeData, 'trigger'>;
export type SendMessageFlowNode = Node<SendMessageNodeData, 'send_message'>;
export type WaitDelayFlowNode = Node<WaitDelayNodeData, 'wait_delay'>;
export type ConditionFlowNode = Node<ConditionNodeData, 'condition'>;
export type ActionFlowNode = Node<ActionNodeData, 'action'>;
export type EndFlowNode = Node<EndNodeData, 'end'>;

export type AppNode =
  | TriggerFlowNode
  | SendMessageFlowNode
  | WaitDelayFlowNode
  | ConditionFlowNode
  | ActionFlowNode
  | EndFlowNode;

export type AppEdge = Edge;

// Defaults para criacao de novos nos
export function getDefaultNodeData(type: FlowNodeType): Record<string, unknown> {
  switch (type) {
    case 'trigger':
      return { label: 'Gatilho', triggerType: 'manual', config: {} } satisfies TriggerNodeData;
    case 'send_message':
      return { label: 'Enviar Mensagem', messages: [{ message_type: 'text', text_content: '' }] } satisfies SendMessageNodeData;
    case 'wait_delay':
      return { label: 'Aguardar', delay_value: 1, delay_unit: 'days' } satisfies WaitDelayNodeData;
    case 'condition':
      return { label: 'Condição', condition_type: 'lead_responded', config: {} } satisfies ConditionNodeData;
    case 'action':
      return { label: 'Ação', action_type: 'move_stage', config: {} } satisfies ActionNodeData;
    case 'end':
      return { label: 'Fim', outcome: 'neutral' } satisfies EndNodeData;
  }
}

// Paleta de nos disponiveis
export const NODE_PALETTE: { type: FlowNodeType; label: string; description: string }[] = [
  { type: 'trigger', label: 'Gatilho', description: 'Inicio do fluxo' },
  { type: 'send_message', label: 'Enviar Mensagem', description: 'Texto, audio, imagem ou video' },
  { type: 'wait_delay', label: 'Aguardar', description: 'Pausar por tempo' },
  { type: 'condition', label: 'Condição', description: 'Ramificação Sim/Não' },
  { type: 'action', label: 'Ação', description: 'Mover stage, atualizar campo' },
  { type: 'end', label: 'Fim', description: 'Finalizar caminho' },
];

// Variaveis disponiveis para mensagens
export const FLOW_VARIABLES = [
  { token: '{{lead_nome}}', label: 'Nome do Lead' },
  { token: '{{lead_telefone}}', label: 'Telefone' },
  { token: '{{lead_email}}', label: 'E-mail' },
  { token: '{{lead_clinica}}', label: 'Nome da Clínica' },
  { token: '{{lead_melhor_horario}}', label: 'Melhor Horário de Contato' },
  { token: '{{lead_score}}', label: 'Score do Lead' },
  { token: '{{lead_origem}}', label: 'Origem (fonte)' },
  { token: '{{company_name}}', label: 'Nome da Empresa' },
  { token: '{{saudacao}}', label: 'Saudação (Bom dia/Boa tarde)' },
  { token: '{{meeting_link}}', label: 'Link da Reunião' },
  { token: '{{meeting_datetime}}', label: 'Data/Hora da Reunião' },
  { token: '{{meeting_date}}', label: 'Data da Reunião' },
  { token: '{{meeting_time}}', label: 'Hora da Reunião' },
];

// Stages do pipeline (mesmo padrao do KanbanView)
export const PIPELINE_STAGES = [
  'Novo Lead',
  'Contato Iniciado',
  'Em Follow-up',
  'Qualificando',
  'Reunião Agendada',
  'No Show',
  'Reunião Realizada',
  'Proposta Enviada',
  'Negociação',
  'Fechado',
  'Perdido',
];
